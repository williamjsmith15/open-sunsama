/**
 * Keeps a task's time blocks on the task's day, and its planned time in
 * step with its blocks and subtasks.
 */
import type { TimerDb } from "../lib/timer-service.js";
import { getDb, and, eq, isNull, sql, subtasks, tasks, timeBlocks } from '@open-sunsama/database';

export interface TaskDayChange {
  taskId: string;
  /** The day the task was on before the change; null for the backlog. */
  from: string | null;
}

/**
 * When a task moves to another day, its blocks on the old day move with it
 * and keep their times. When it goes back to the backlog, those blocks come
 * off the calendar. Blocks on other days are left alone. Returns how many
 * blocks changed.
 */
export async function moveBlocksWithTasks(
  userId: string,
  changes: TaskDayChange[],
  to: string | null,
  db: TimerDb = getDb()
): Promise<number> {
  let changed = 0;
  for (const { taskId, from } of changes) {
    if (!from || from === to) continue;
    const onOldDay = and(
      eq(timeBlocks.userId, userId),
      eq(timeBlocks.taskId, taskId),
      eq(timeBlocks.date, from)
    );
    const rows = to
      ? await db
          .update(timeBlocks)
          .set({ date: to, updatedAt: new Date() })
          .where(onOldDay)
          .returning({ id: timeBlocks.id })
      : await db.delete(timeBlocks).where(onOldDay).returning({ id: timeBlocks.id });
    changed += rows.length;
  }
  return changed;
}

type EstimateTask = { id: string; scheduledDate: string | null; estimatedMins: number | null };
const estimateFields = {
  id: tasks.id,
  scheduledDate: tasks.scheduledDate,
  estimatedMins: tasks.estimatedMins,
};

/**
 * Until the user sets a task's planned time themselves, it is the total of
 * its subtasks' planned times. Does nothing when no subtask has a time.
 * Returns the task when its planned time changed.
 */
export async function syncEstimateFromSubtasks(
  userId: string,
  taskId: string,
  db: TimerDb = getDb()
): Promise<EstimateTask | null> {
  const [total] = await db
    .select({ mins: sql<number>`COALESCE(SUM(${subtasks.estimatedMins}), 0)::int` })
    .from(subtasks)
    .where(eq(subtasks.taskId, taskId));
  const mins = Math.min(total?.mins ?? 0, 1440);
  if (mins <= 0) return null;
  const [task] = await db
    .update(tasks)
    .set({ estimatedMins: mins, updatedAt: new Date() })
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.userId, userId),
        eq(tasks.estimatedMinsManual, false),
        sql`${tasks.estimatedMins} IS DISTINCT FROM ${mins}`
      )
    )
    .returning(estimateFields);
  return task ?? null;
}

const blockTotal = async (db: TimerDb, where: ReturnType<typeof and>) => {
  const [total] = await db
    .select({ mins: sql<number>`COALESCE(SUM(${timeBlocks.durationMins}), 0)::int` })
    .from(timeBlocks)
    .where(where);
  return Math.min(total?.mins ?? 0, 1440);
};

/**
 * After a block was resized, re-plan what it's for:
 * - a subtask's block sets the subtask's planned time to the total of its
 *   blocks, and the task follows its subtasks (unless set by hand);
 * - a task's own block sets the task's planned time to the total of the
 *   task's own blocks, which counts as setting it by hand.
 * Returns the task when its planned time changed.
 */
export async function syncEstimateFromBlocks(
  userId: string,
  block: { taskId: string; subtaskId: string | null },
  db: TimerDb = getDb()
): Promise<EstimateTask | null> {
  if (block.subtaskId) {
    const mins = await blockTotal(
      db,
      and(eq(timeBlocks.userId, userId), eq(timeBlocks.subtaskId, block.subtaskId))
    );
    if (mins <= 0) return null;
    await db
      .update(subtasks)
      .set({ estimatedMins: mins, updatedAt: new Date() })
      .where(and(eq(subtasks.id, block.subtaskId), eq(subtasks.taskId, block.taskId)));
    return syncEstimateFromSubtasks(userId, block.taskId, db);
  }
  const mins = await blockTotal(
    db,
    and(
      eq(timeBlocks.userId, userId),
      eq(timeBlocks.taskId, block.taskId),
      isNull(timeBlocks.subtaskId)
    )
  );
  if (mins <= 0) return null;
  const [task] = await db
    .update(tasks)
    .set({ estimatedMins: mins, estimatedMinsManual: true, updatedAt: new Date() })
    .where(and(eq(tasks.id, block.taskId), eq(tasks.userId, userId)))
    .returning(estimateFields);
  return task ?? null;
}

/** How many blocks a task has of its own (not its subtasks'), or a subtask has. */
export async function countBlocks(
  userId: string,
  block: { taskId: string; subtaskId: string | null },
  db: TimerDb = getDb()
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(timeBlocks)
    .where(
      block.subtaskId
        ? and(eq(timeBlocks.userId, userId), eq(timeBlocks.subtaskId, block.subtaskId))
        : and(
            eq(timeBlocks.userId, userId),
            eq(timeBlocks.taskId, block.taskId),
            isNull(timeBlocks.subtaskId)
          )
    );
  return row?.n ?? 0;
}
