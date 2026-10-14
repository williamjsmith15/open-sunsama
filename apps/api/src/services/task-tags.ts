/**
 * Tags on tasks: attach each task's tag IDs to API responses, and replace a
 * task's set of tags.
 */
import {
  getDb,
  eq,
  and,
  inArray,
  tags,
  taskTags,
} from "@open-sunsama/database";
import { ValidationError } from "@open-sunsama/utils";

type Db = Pick<ReturnType<typeof getDb>, "select" | "insert" | "delete">;

/** Map of task ID → its tag IDs, for the given tasks. */
export async function tagIdsByTask(
  taskIds: string[],
  db: Db = getDb()
): Promise<Map<string, string[]>> {
  const byTask = new Map<string, string[]>(taskIds.map((id) => [id, []]));
  if (taskIds.length === 0) return byTask;
  const rows = await db
    .select({ taskId: taskTags.taskId, tagId: taskTags.tagId })
    .from(taskTags)
    .where(inArray(taskTags.taskId, taskIds));
  for (const row of rows) byTask.get(row.taskId)?.push(row.tagId);
  return byTask;
}

/** Add `tagIds` to each task. */
export async function withTagIds<T extends { id: string }>(
  list: T[],
  db: Db = getDb()
): Promise<Array<T & { tagIds: string[] }>> {
  const byTask = await tagIdsByTask(
    list.map((t) => t.id),
    db
  );
  return list.map((t) => ({ ...t, tagIds: byTask.get(t.id) ?? [] }));
}

/** Add `tagIds` to one task (null passes through). */
export async function withTaskTagIds<T extends { id: string }>(
  task: T | null | undefined,
  db: Db = getDb()
): Promise<(T & { tagIds: string[] }) | null> {
  if (!task) return null;
  const [withTags] = await withTagIds([task], db);
  return withTags ?? null;
}

/**
 * Replace a task's tags with `tagIds`. Every tag must belong to the user.
 * The caller has already checked the task belongs to the user.
 */
export async function setTaskTags(
  userId: string,
  taskId: string,
  tagIds: string[],
  db: Db = getDb()
): Promise<void> {
  const unique = [...new Set(tagIds)];
  if (unique.length > 0) {
    const owned = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.id, unique)));
    if (owned.length !== unique.length) {
      throw new ValidationError("Unknown tag");
    }
  }
  await db.delete(taskTags).where(eq(taskTags.taskId, taskId));
  if (unique.length > 0) {
    await db.insert(taskTags).values(unique.map((tagId) => ({ taskId, tagId })));
  }
}
