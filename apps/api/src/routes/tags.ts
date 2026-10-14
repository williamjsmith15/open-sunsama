/**
 * Tag routes for Open Sunsama API.
 * Labels that cut across projects; set on tasks through `tagIds` on the task
 * endpoints. Mounted at /tags. Uses the task scopes.
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  getDb,
  eq,
  and,
  asc,
  isNull,
  sql,
  tags,
  taskTags,
  tasks,
} from "@open-sunsama/database";
import { ConflictError, NotFoundError, uuidSchema } from "@open-sunsama/utils";
import { auth, requireScopes, type AuthVariables } from "../middleware/auth.js";
import { createTagSchema, updateTagSchema } from "../validation/tags.js";
import { publishEvent } from "../lib/websocket/index.js";

const tagsRouter = new Hono<{ Variables: AuthVariables }>();
tagsRouter.use("*", auth);

const READ = requireScopes("tasks:read");
const WRITE = requireScopes("tasks:write");

/** Unique violation on (user, lower(name)) → a readable conflict. */
function isDuplicateName(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

async function assertTagOwned(userId: string, id: string) {
  const [tag] = await getDb()
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
    .limit(1);
  if (!tag) throw new NotFoundError("Tag", id);
}

/** GET /tags - the user's tags by name, with how many open tasks use each */
tagsRouter.get("/", READ, async (c) => {
  const userId = c.get("userId");
  const db = getDb();
  const data = await db
    .select({
      id: tags.id,
      userId: tags.userId,
      name: tags.name,
      color: tags.color,
      createdAt: tags.createdAt,
      updatedAt: tags.updatedAt,
      openTaskCount: sql<number>`count(${tasks.id})::int`,
    })
    .from(tags)
    .leftJoin(taskTags, eq(taskTags.tagId, tags.id))
    .leftJoin(
      tasks,
      and(eq(tasks.id, taskTags.taskId), isNull(tasks.completedAt))
    )
    .where(eq(tags.userId, userId))
    .groupBy(tags.id)
    .orderBy(asc(sql`lower(${tags.name})`));
  return c.json({ success: true, data });
});

/** POST /tags - create a tag; names are unique per user, ignoring case */
tagsRouter.post("/", WRITE, zValidator("json", createTagSchema), async (c) => {
  const userId = c.get("userId");
  const data = c.req.valid("json");
  try {
    const [tag] = await getDb()
      .insert(tags)
      .values({ userId, name: data.name, color: data.color ?? "#6B7280" })
      .returning();
    if (!tag) throw new Error("Failed to create tag");
    publishEvent(userId, "tag:created", { tagId: tag.id });
    return c.json({ success: true, data: { ...tag, openTaskCount: 0 } }, 201);
  } catch (error) {
    if (isDuplicateName(error)) {
      throw new ConflictError(`A tag called “${data.name}” already exists`, "name");
    }
    throw error;
  }
});

/** PATCH /tags/:id - rename or recolor */
tagsRouter.patch(
  "/:id",
  WRITE,
  zValidator("param", z.object({ id: uuidSchema })),
  zValidator("json", updateTagSchema),
  async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.valid("param");
    const updates = c.req.valid("json");
    await assertTagOwned(userId, id);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.color !== undefined) updateData.color = updates.color;

    try {
      const [tag] = await getDb()
        .update(tags)
        .set(updateData)
        .where(and(eq(tags.id, id), eq(tags.userId, userId)))
        .returning();
      publishEvent(userId, "tag:updated", { tagId: id });
      return c.json({ success: true, data: tag });
    } catch (error) {
      if (isDuplicateName(error)) {
        throw new ConflictError(`A tag called “${updates.name}” already exists`, "name");
      }
      throw error;
    }
  }
);

/** DELETE /tags/:id - delete a tag; it comes off every task */
tagsRouter.delete(
  "/:id",
  WRITE,
  zValidator("param", z.object({ id: uuidSchema })),
  async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.valid("param");
    await assertTagOwned(userId, id);
    await getDb().delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
    publishEvent(userId, "tag:deleted", { tagId: id });
    publishEvent(userId, "task:updated", {});
    return c.json({ success: true, message: "Tag deleted successfully" });
  }
);

export { tagsRouter };
