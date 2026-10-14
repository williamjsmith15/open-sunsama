import { describe, it, expect } from "vitest";
import { getTableName } from "drizzle-orm";
import {
  BACKUP_TABLES,
  backupFileSchema,
  restoreBackupSchema,
  sanitizeBackupData,
  toInsertRow,
} from "./backup.js";
import { tasks } from "@open-sunsama/database";

const T1 = "00000000-0000-4000-8000-000000000001";
const T2 = "00000000-0000-4000-8000-000000000002";
const MISSING = "00000000-0000-4000-8000-0000000000ff";

describe("backup", () => {
  it("lists every table after the tables it references", () => {
    const order = BACKUP_TABLES.map((t) => t.key);
    expect(order.indexOf("taskSeries")).toBeLessThan(order.indexOf("tasks"));
    expect(order.indexOf("tasks")).toBeLessThan(order.indexOf("subtasks"));
    expect(order.indexOf("tasks")).toBeLessThan(order.indexOf("ideas"));
    expect(order.indexOf("ideaColumns")).toBeLessThan(order.indexOf("ideas"));
    expect(order.indexOf("ideas")).toBeLessThan(order.indexOf("ideaSubtasks"));
    expect(new Set(BACKUP_TABLES.map((t) => getTableName(t.table))).size).toBe(
      BACKUP_TABLES.length
    );
  });

  it("restores tables missing from an older backup as empty", () => {
    const data = sanitizeBackupData({ tasks: [{ id: T1, title: "a" }] }, new Set());
    for (const { key } of BACKUP_TABLES) expect(Array.isArray(data[key])).toBe(true);
    expect(data.tasks).toHaveLength(1);
    expect(data.ideas).toEqual([]);
  });

  it("clears or drops references to rows outside the backup", () => {
    const data = sanitizeBackupData(
      {
        tasks: [
          { id: T1, title: "a", seriesId: MISSING, seriesInstanceNumber: 3, timerStartedAt: "2026-01-01T00:00:00Z" },
          { id: T1, title: "duplicate" },
          { id: T2, title: "b" },
        ],
        subtasks: [
          { id: "s1", taskId: T1 },
          { id: "s2", taskId: MISSING },
        ],
        timeBlocks: [{ id: "b1", taskId: MISSING }],
        taskExternalLinks: [
          { id: "l1", taskId: T2, accountId: MISSING },
          { id: "l2", taskId: MISSING },
        ],
        ideaBoards: [{ id: "board" }],
        ideaColumns: [{ id: "col", boardId: "board" }, { id: "orphan", boardId: MISSING }],
        ideas: [
          { id: "i1", boardId: "board", columnId: "col", promotedTaskId: MISSING },
          { id: "i2", boardId: "board", columnId: "orphan" },
        ],
        ideaSubtasks: [{ id: "is1", ideaId: "i1" }, { id: "is2", ideaId: "i2" }],
      },
      new Set()
    );

    expect(data.tasks.map((t) => t.title)).toEqual(["a", "b"]);
    expect(data.tasks[0]).toMatchObject({ seriesId: null, seriesInstanceNumber: null, timerStartedAt: null });
    expect(data.subtasks.map((s) => s.id)).toEqual(["s1"]);
    expect(data.timeBlocks[0]!.taskId).toBeNull();
    expect(data.taskExternalLinks).toEqual([expect.objectContaining({ id: "l1", accountId: null })]);
    expect(data.ideaColumns.map((c) => c.id)).toEqual(["col"]);
    expect(data.ideas).toEqual([expect.objectContaining({ id: "i1", promotedTaskId: null })]);
    expect(data.ideaSubtasks.map((s) => s.id)).toEqual(["is1"]);
  });

  it("keeps known columns, parses timestamps and reassigns the owner", () => {
    const row = toInsertRow(
      tasks,
      {
        id: T1,
        userId: "someone-else",
        title: "a",
        scheduledDate: "2026-10-13",
        createdAt: "2026-10-01T10:00:00.000Z",
        columnFromTheFuture: true,
      },
      "me"
    );
    expect(row).toEqual({
      id: T1,
      userId: "me",
      title: "a",
      scheduledDate: "2026-10-13",
      createdAt: new Date("2026-10-01T10:00:00.000Z"),
    });
  });

  it("rejects files that aren't backups or are from a newer version", () => {
    expect(backupFileSchema.safeParse({ format: "other", version: 1, data: {} }).success).toBe(false);
    expect(
      backupFileSchema.safeParse({ format: "open-sunsama-backup", version: 99, data: {} }).success
    ).toBe(false);
    const backup = { format: "open-sunsama-backup", version: 1, data: { tasks: [] } };
    expect(restoreBackupSchema.safeParse({ backup }).success).toBe(false);
    expect(restoreBackupSchema.safeParse({ confirm: "REPLACE", backup }).success).toBe(true);
  });
});
