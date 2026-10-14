/**
 * Project routes for Open Sunsama API.
 * Flat projects that group tasks. Mounted at /projects. Uses the task
 * scopes, since a project is part of the task model.
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  getDb,
  eq,
  and,
  asc,
  isNotNull,
  sql,
  projects,
  tasks,
} from "@open-sunsama/database";
import { NotFoundError, ValidationError, uuidSchema } from "@open-sunsama/utils";
import { auth, requireScopes, type AuthVariables } from "../middleware/auth.js";
import {
  createProjectSchema,
  updateProjectSchema,
  reorderProjectsSchema,
} from "../validation/projects.js";
import { publishEvent } from "../lib/websocket/index.js";

const projectsRouter = new Hono<{ Variables: AuthVariables }>();
projectsRouter.use("*", auth);

const READ = requireScopes("tasks:read");
const WRITE = requireScopes("tasks:write");

/** Verify a project belongs to the user; throws NotFoundError otherwise. */
export async function assertProjectOwned(userId: string, projectId: string) {
  const [project] = await getDb()
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) throw new NotFoundError("Project", projectId);
}

/** Projects with open/completed task counts, in rail order. */
async function listProjects(userId: string) {
  const db = getDb();
  const [rows, counts] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(asc(projects.position), asc(projects.createdAt)),
    db
      .select({
        projectId: tasks.projectId,
        open: sql<number>`count(*) filter (where ${tasks.completedAt} is null)::int`,
        completed: sql<number>`count(*) filter (where ${tasks.completedAt} is not null)::int`,
      })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), isNotNull(tasks.projectId)))
      .groupBy(tasks.projectId),
  ]);
  const byId = new Map(counts.map((c) => [c.projectId, c]));
  return rows.map((p) => ({
    ...p,
    openTaskCount: byId.get(p.id)?.open ?? 0,
    completedTaskCount: byId.get(p.id)?.completed ?? 0,
  }));
}

/** GET /projects - list the user's projects with task counts */
projectsRouter.get("/", READ, async (c) => {
  return c.json({ success: true, data: await listProjects(c.get("userId")) });
});

/** POST /projects - create a project at the end of the rail */
projectsRouter.post(
  "/",
  WRITE,
  zValidator("json", createProjectSchema),
  async (c) => {
    const userId = c.get("userId");
    const data = c.req.valid("json");
    const db = getDb();

    const [maxPos] = await db
      .select({ max: sql<number>`COALESCE(MAX(${projects.position}), -1)` })
      .from(projects)
      .where(eq(projects.userId, userId));

    const [project] = await db
      .insert(projects)
      .values({
        userId,
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? "#6366F1",
        icon: data.icon ?? "Folder",
        status: data.status ?? "active",
        targetDate: data.targetDate ?? null,
        position: (maxPos?.max ?? -1) + 1,
      })
      .returning();
    if (!project) throw new Error("Failed to create project");

    publishEvent(userId, "project:created", { projectId: project.id });
    return c.json(
      { success: true, data: { ...project, openTaskCount: 0, completedTaskCount: 0 } },
      201
    );
  }
);

/** POST /projects/reorder - set the rail order; every project ID exactly once */
projectsRouter.post(
  "/reorder",
  WRITE,
  zValidator("json", reorderProjectsSchema),
  async (c) => {
    const userId = c.get("userId");
    const { projectIds } = c.req.valid("json");
    const db = getDb();

    const owned = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.userId, userId));
    if (
      projectIds.length !== owned.length ||
      owned.some((p) => !projectIds.includes(p.id))
    ) {
      throw new ValidationError("Supply every project ID exactly once");
    }

    await db.transaction(async (tx) => {
      for (const [index, id] of projectIds.entries()) {
        await tx
          .update(projects)
          .set({ position: index, updatedAt: new Date() })
          .where(and(eq(projects.id, id), eq(projects.userId, userId)));
      }
    });

    publishEvent(userId, "project:reordered", { projectIds });
    return c.json({ success: true, data: await listProjects(userId) });
  }
);

/** GET /projects/:id - one project with task counts */
projectsRouter.get(
  "/:id",
  READ,
  zValidator("param", z.object({ id: uuidSchema })),
  async (c) => {
    const { id } = c.req.valid("param");
    const project = (await listProjects(c.get("userId"))).find((p) => p.id === id);
    if (!project) throw new NotFoundError("Project", id);
    return c.json({ success: true, data: project });
  }
);

/** PATCH /projects/:id - rename, recolor, change status or target date */
projectsRouter.patch(
  "/:id",
  WRITE,
  zValidator("param", z.object({ id: uuidSchema })),
  zValidator("json", updateProjectSchema),
  async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.valid("param");
    const updates = c.req.valid("json");
    await assertProjectOwned(userId, id);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of [
      "name",
      "description",
      "color",
      "icon",
      "status",
      "targetDate",
    ] as const) {
      if (updates[key] !== undefined) updateData[key] = updates[key];
    }

    const [project] = await getDb()
      .update(projects)
      .set(updateData)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();

    publishEvent(userId, "project:updated", { projectId: id });
    return c.json({ success: true, data: project });
  }
);

/** DELETE /projects/:id - delete a project; its tasks stay, unassigned */
projectsRouter.delete(
  "/:id",
  WRITE,
  zValidator("param", z.object({ id: uuidSchema })),
  async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.valid("param");
    await assertProjectOwned(userId, id);

    // tasks.project_id is ON DELETE SET NULL
    await getDb()
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));

    publishEvent(userId, "project:deleted", { projectId: id });
    // Unassigned tasks changed too
    publishEvent(userId, "task:updated", {});
    return c.json({ success: true, message: "Project deleted successfully" });
  }
);

export { projectsRouter };
