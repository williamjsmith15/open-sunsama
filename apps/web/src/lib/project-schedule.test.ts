import { describe, it, expect } from "vitest";
import {
  dependencyLayers,
  isBlocked,
  topologicalOrder,
  type ScheduleTask,
} from "./project-schedule";

function task(id: string, over: Partial<ScheduleTask> = {}): ScheduleTask {
  return {
    id,
    title: id,
    completedAt: null,
    scheduledDate: null,
    dueDate: null,
    estimatedMins: 60,
    blockedBy: [],
    ...over,
  };
}
const after = (...ids: string[]) => ids.map((id) => ({ id }));

describe("topologicalOrder", () => {
  it("puts blockers first and breaks ties by date", () => {
    const tasks = [
      task("c", { blockedBy: after("a", "b") }),
      task("b", { scheduledDate: "2026-10-02" }),
      task("a", { scheduledDate: "2026-10-01" }),
    ];
    expect(topologicalOrder(tasks)).toEqual(["a", "b", "c"]);
  });

  it("ignores blockers outside the list", () => {
    expect(topologicalOrder([task("a", { blockedBy: after("elsewhere") })])).toEqual(["a"]);
  });
});

describe("dependencyLayers", () => {
  it("uses the longest chain of blockers", () => {
    const layers = dependencyLayers([
      task("a"),
      task("b", { blockedBy: after("a") }),
      task("c", { blockedBy: after("a", "b") }),
      task("d"),
    ]);
    expect(Object.fromEntries(layers)).toEqual({ a: 0, b: 1, c: 2, d: 0 });
  });
});

describe("isBlocked", () => {
  it("is true while any blocker is open", () => {
    expect(isBlocked({ blockedBy: [{ completedAt: null }, { completedAt: "x" }] })).toBe(true);
    expect(isBlocked({ blockedBy: [{ completedAt: "x" }] })).toBe(false);
    expect(isBlocked({})).toBe(false);
  });
});
