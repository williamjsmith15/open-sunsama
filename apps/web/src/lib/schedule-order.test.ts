import { describe, it, expect } from "vitest";
import { orderBySchedule } from "./schedule-order";

describe("orderBySchedule", () => {
  it("puts unblocked tasks first, then blocked ones by start time", () => {
    const tasks = [
      { id: "late", position: 0 },
      { id: "free-b", position: 3 },
      { id: "early", position: 1 },
      { id: "free-a", position: 2 },
    ];
    const starts = new Map([
      ["late", new Date("2026-10-14T15:00:00")],
      ["early", new Date("2026-10-14T09:00:00")],
    ]);
    expect(orderBySchedule(tasks, starts).map((t) => t.id)).toEqual([
      "free-a",
      "free-b",
      "early",
      "late",
    ]);
  });
});
