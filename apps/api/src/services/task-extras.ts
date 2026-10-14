/**
 * Everything task responses carry beyond the row itself: tag IDs and
 * dependency summaries. One place, so every task endpoint returns the same
 * shape.
 */
import { getDb } from "@open-sunsama/database";
import { tagIdsByTask } from "./task-tags.js";
import { dependencySummaries, type DependencySummary } from "./task-dependencies.js";

type Db = Parameters<typeof tagIdsByTask>[1] & Parameters<typeof dependencySummaries>[1];

export type TaskExtras = { tagIds: string[] } & DependencySummary;

export async function withTaskExtras<T extends { id: string }>(
  list: T[],
  db: Db = getDb()
): Promise<Array<T & TaskExtras>> {
  const ids = list.map((t) => t.id);
  const [tagsByTask, depsByTask] = await Promise.all([
    tagIdsByTask(ids, db),
    dependencySummaries(ids, db),
  ]);
  return list.map((t) => ({
    ...t,
    tagIds: tagsByTask.get(t.id) ?? [],
    blockedBy: depsByTask.get(t.id)?.blockedBy ?? [],
    blocking: depsByTask.get(t.id)?.blocking ?? [],
  }));
}

export async function withOneTaskExtras<T extends { id: string }>(
  task: T | null | undefined,
  db: Db = getDb()
): Promise<(T & TaskExtras) | null> {
  if (!task) return null;
  const [one] = await withTaskExtras([task], db);
  return one ?? null;
}
