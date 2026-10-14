/**
 * Backup routes for Open Sunsama API.
 * Export the signed-in user's tasks, routines, time blocks and ideas as one
 * JSON file, and restore such a file by replacing that data.
 * Mounted at /backup. Signed-in sessions only: API keys and MCP tokens can't
 * export or wipe a whole account.
 */
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { zValidator } from "@hono/zod-validator";
import { AuthorizationError, ConflictError } from "@open-sunsama/utils";
import { auth, type AuthVariables } from "../middleware/auth.js";
import { publishEvent } from "../lib/websocket/index.js";
import {
  exportUserData,
  restoreBackupSchema,
  restoreUserData,
} from "../services/backup.js";
import { APP_VERSION } from "../version.js";

const backupRouter = new Hono<{ Variables: AuthVariables }>();
backupRouter.use("*", auth);
backupRouter.use("*", async (c, next) => {
  if (c.get("authMethod") !== "jwt") {
    throw new AuthorizationError("Backups require a signed-in session");
  }
  await next();
});

/** GET /backup/export - download every backed-up row for the user */
backupRouter.get("/export", async (c) => {
  const backup = await exportUserData(c.get("userId"), APP_VERSION);
  const day = backup.exportedAt.slice(0, 10);
  c.header(
    "Content-Disposition",
    `attachment; filename="open-sunsama-backup-${day}.json"`
  );
  return c.json({ success: true, data: backup });
});

/** POST /backup/restore - replace the user's data with a backup */
backupRouter.post(
  "/restore",
  bodyLimit({ maxSize: 25 * 1024 * 1024 }),
  zValidator("json", restoreBackupSchema),
  async (c) => {
    const userId = c.get("userId");
    const { backup } = c.req.valid("json");
    let counts: Record<string, number>;
    try {
      counts = await restoreUserData(userId, backup);
    } catch (error) {
      // A row id already used by someone else, e.g. a backup from another account.
      const e = error as { code?: string; cause?: { code?: string } };
      if (e?.code === "23505" || e?.cause?.code === "23505") {
        throw new ConflictError(
          "This backup's records already exist in another account and can't be restored here"
        );
      }
      throw error;
    }
    await publishEvent(userId, "data:restored", { counts });
    return c.json({ success: true, data: { counts } });
  }
);

export { backupRouter };
