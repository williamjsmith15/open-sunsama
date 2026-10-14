/**
 * Per-user JSON backup: export everything a user has planned, and restore a
 * backup by replacing that data wholesale.
 *
 * BACKUP_TABLES is the single list of what a backup holds, in insert order
 * (parents before children). Adding a table to the task model means adding
 * it here, nowhere else. Restores tolerate older backups: a table missing
 * from the file restores as empty, and unknown columns are dropped.
 */
import { getTableColumns, type Table } from "drizzle-orm";
import { z } from "zod";
import {
  getDb,
  eq,
  inArray,
  tasks,
  taskSeries,
  subtasks,
  timeBlocks,
  attachments,
  taskExternalLinks,
  integrationAccounts,
  ideaBoards,
  ideaColumns,
  ideas,
  ideaSubtasks,
  projects,
  tags,
  taskTags,
  taskDependencies,
} from "@open-sunsama/database";

export const BACKUP_FORMAT = "open-sunsama-backup";
/** Bump when a change can't be read by older restore code. */
export const BACKUP_VERSION = 1;

type Row = Record<string, unknown>;
export type BackupData = Record<string, Row[]>;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  appVersion: string;
  data: BackupData;
}

/** Insert order: every table comes after the tables it references. */
export const BACKUP_TABLES = [
  { key: "projects", table: projects },
  { key: "taskSeries", table: taskSeries },
  { key: "tasks", table: tasks },
  { key: "subtasks", table: subtasks },
  { key: "tags", table: tags },
  { key: "taskTags", table: taskTags },
  { key: "taskDependencies", table: taskDependencies },
  { key: "timeBlocks", table: timeBlocks },
  { key: "attachments", table: attachments },
  { key: "taskExternalLinks", table: taskExternalLinks },
  { key: "ideaBoards", table: ideaBoards },
  { key: "ideaColumns", table: ideaColumns },
  { key: "ideas", table: ideas },
  { key: "ideaSubtasks", table: ideaSubtasks },
] as const satisfies readonly { key: string; table: Table }[];

export type BackupTableKey = (typeof BACKUP_TABLES)[number]["key"];

export const backupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z
    .number()
    .int()
    .min(1)
    .max(BACKUP_VERSION, {
      error: "This backup was made by a newer version of Open Sunsama",
    }),
  exportedAt: z.string().optional(),
  appVersion: z.string().optional(),
  data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

export const restoreBackupSchema = z.object({
  confirm: z.literal("REPLACE", { error: 'Set confirm to "REPLACE"' }),
  backup: backupFileSchema,
});

// ───────────────────────── pure helpers ─────────────────────────

const ids = (rows: Row[] | undefined) =>
  new Set((rows ?? []).map((r) => r.id as string));

/** Drop rows without an id and keep the first row for each id. */
function dedupe(rows: Row[]): Row[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (typeof row.id !== "string" || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

/**
 * Make a backup's rows consistent before they are inserted: every table is
 * present, references to rows that aren't in the backup are cleared (or the
 * row dropped when the reference is required), and running timers are reset.
 * `accountIds` are the user's current integration accounts, which a backup
 * doesn't hold.
 */
export function sanitizeBackupData(
  raw: BackupData,
  accountIds: Set<string>
): Record<BackupTableKey, Row[]> {
  const data = {} as Record<BackupTableKey, Row[]>;
  for (const { key } of BACKUP_TABLES) {
    data[key] = dedupe((raw[key] ?? []).map((row) => ({ ...row })));
  }

  const seriesIds = ids(data.taskSeries);
  const projectIds = ids(data.projects);
  for (const task of data.tasks) {
    if (task.projectId && !projectIds.has(task.projectId as string)) {
      task.projectId = null;
    }
    if (task.seriesId && !seriesIds.has(task.seriesId as string)) {
      task.seriesId = null;
      task.seriesInstanceNumber = null;
    }
    task.timerStartedAt = null;
  }

  const taskIds = ids(data.tasks);
  data.subtasks = data.subtasks.filter((s) => taskIds.has(s.taskId as string));
  const tagIds = ids(data.tags);
  data.taskTags = data.taskTags.filter(
    (tt) => taskIds.has(tt.taskId as string) && tagIds.has(tt.tagId as string)
  );
  data.taskDependencies = data.taskDependencies.filter(
    (d) =>
      taskIds.has(d.blockerTaskId as string) &&
      taskIds.has(d.blockedTaskId as string) &&
      d.blockerTaskId !== d.blockedTaskId
  );
  for (const subtask of data.subtasks) subtask.timerStartedAt = null;
  for (const block of data.timeBlocks) {
    if (block.taskId && !taskIds.has(block.taskId as string)) block.taskId = null;
  }
  data.attachments = data.attachments.filter(
    (a) => !a.taskId || taskIds.has(a.taskId as string)
  );
  data.taskExternalLinks = data.taskExternalLinks.filter((link) =>
    taskIds.has(link.taskId as string)
  );
  for (const link of data.taskExternalLinks) {
    if (link.accountId && !accountIds.has(link.accountId as string)) {
      link.accountId = null;
    }
  }

  const boardIds = ids(data.ideaBoards);
  data.ideaColumns = data.ideaColumns.filter((c) =>
    boardIds.has(c.boardId as string)
  );
  const columnIds = ids(data.ideaColumns);
  data.ideas = data.ideas.filter(
    (i) =>
      boardIds.has(i.boardId as string) && columnIds.has(i.columnId as string)
  );
  for (const idea of data.ideas) {
    if (idea.promotedTaskId && !taskIds.has(idea.promotedTaskId as string)) {
      idea.promotedTaskId = null;
    }
  }
  const ideaIds = ids(data.ideas);
  data.ideaSubtasks = data.ideaSubtasks.filter((s) =>
    ideaIds.has(s.ideaId as string)
  );

  return data;
}

/**
 * Shape a JSON row for insert into `table`: keep only the table's columns,
 * turn timestamp strings back into Dates, and give it to `userId`.
 */
export function toInsertRow(table: Table, row: Row, userId: string): Row {
  const columns = getTableColumns(table);
  const out: Row = {};
  for (const [key, column] of Object.entries(columns)) {
    if (!(key in row)) continue;
    const value = row[key];
    out[key] =
      column.columnType === "PgTimestamp" && typeof value === "string"
        ? new Date(value)
        : value;
  }
  if ("userId" in columns) out.userId = userId;
  return out;
}

export function countRows(data: BackupData): Record<string, number> {
  return Object.fromEntries(
    BACKUP_TABLES.map(({ key }) => [key, data[key]?.length ?? 0])
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ───────────────────────── database ─────────────────────────

export async function exportUserData(
  userId: string,
  appVersion: string
): Promise<BackupFile> {
  const db = getDb();
  const [
    seriesRows,
    taskRows,
    blockRows,
    attachmentRows,
    linkRows,
    boardRows,
    columnRows,
    ideaRows,
    projectRows,
    tagRows,
    dependencyRows,
  ] = await Promise.all([
    db.select().from(taskSeries).where(eq(taskSeries.userId, userId)),
    db.select().from(tasks).where(eq(tasks.userId, userId)),
    db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId)),
    db.select().from(attachments).where(eq(attachments.userId, userId)),
    db.select().from(taskExternalLinks).where(eq(taskExternalLinks.userId, userId)),
    db.select().from(ideaBoards).where(eq(ideaBoards.userId, userId)),
    db.select().from(ideaColumns).where(eq(ideaColumns.userId, userId)),
    db.select().from(ideas).where(eq(ideas.userId, userId)),
    db.select().from(projects).where(eq(projects.userId, userId)),
    db.select().from(tags).where(eq(tags.userId, userId)),
    db.select().from(taskDependencies).where(eq(taskDependencies.userId, userId)),
  ]);

  // Child tables without a user_id column are reached through their parent.
  const [subtaskRows, ideaSubtaskRows, taskTagRows] = await Promise.all([
    db
      .select(getTableColumns(subtasks))
      .from(subtasks)
      .innerJoin(tasks, eq(subtasks.taskId, tasks.id))
      .where(eq(tasks.userId, userId)),
    db
      .select(getTableColumns(ideaSubtasks))
      .from(ideaSubtasks)
      .innerJoin(ideas, eq(ideaSubtasks.ideaId, ideas.id))
      .where(eq(ideas.userId, userId)),
    db
      .select(getTableColumns(taskTags))
      .from(taskTags)
      .innerJoin(tasks, eq(taskTags.taskId, tasks.id))
      .where(eq(tasks.userId, userId)),
  ]);

  const data: Record<BackupTableKey, Row[]> = {
    projects: projectRows,
    tags: tagRows,
    taskTags: taskTagRows,
    taskDependencies: dependencyRows,
    taskSeries: seriesRows,
    tasks: taskRows,
    subtasks: subtaskRows,
    timeBlocks: blockRows,
    attachments: attachmentRows,
    taskExternalLinks: linkRows,
    ideaBoards: boardRows,
    ideaColumns: columnRows,
    ideas: ideaRows,
    ideaSubtasks: ideaSubtaskRows,
  };

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion,
    // Round-trip through JSON so the file and the response agree exactly.
    data: JSON.parse(JSON.stringify(data)) as BackupData,
  };
}

/**
 * Replace all of the user's backed-up data with the backup's, in one
 * transaction: if any insert fails, nothing changes.
 */
export async function restoreUserData(
  userId: string,
  backup: Pick<BackupFile, "data">
): Promise<Record<string, number>> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const accounts = await tx
      .select({ id: integrationAccounts.id })
      .from(integrationAccounts)
      .where(eq(integrationAccounts.userId, userId));
    const data = sanitizeBackupData(
      backup.data,
      new Set(accounts.map((a) => a.id))
    );

    // Children first. Deleting tasks cascades to subtasks, attachments and
    // external links; deleting boards cascades to columns, ideas and their
    // subtasks. The explicit deletes keep this correct if a cascade changes.
    await tx.delete(taskDependencies).where(eq(taskDependencies.userId, userId));
    await tx.delete(timeBlocks).where(eq(timeBlocks.userId, userId));
    await tx.delete(attachments).where(eq(attachments.userId, userId));
    await tx.delete(taskExternalLinks).where(eq(taskExternalLinks.userId, userId));
    await tx.delete(ideas).where(eq(ideas.userId, userId));
    await tx.delete(ideaColumns).where(eq(ideaColumns.userId, userId));
    await tx.delete(ideaBoards).where(eq(ideaBoards.userId, userId));
    const userTaskIds = tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.userId, userId));
    await tx.delete(subtasks).where(inArray(subtasks.taskId, userTaskIds));
    await tx.delete(taskTags).where(inArray(taskTags.taskId, userTaskIds));
    await tx.delete(tags).where(eq(tags.userId, userId));
    await tx.delete(tasks).where(eq(tasks.userId, userId));
    await tx.delete(taskSeries).where(eq(taskSeries.userId, userId));
    await tx.delete(projects).where(eq(projects.userId, userId));

    for (const { key, table } of BACKUP_TABLES) {
      const rows = data[key].map((row) => toInsertRow(table, row, userId));
      for (const batch of chunk(rows, 500)) {
        await tx.insert(table).values(batch as never);
      }
    }

    return countRows(data);
  });
}
