import { describe, it, expect } from "vitest";
import { wouldCreateCycle } from "./task-dependencies.js";

const edge = (blockerTaskId: string, blockedTaskId: string) => ({ blockerTaskId, blockedTaskId });

describe("wouldCreateCycle", () => {
  it("refuses a task blocking itself", () => {
    expect(wouldCreateCycle([], "a", "a")).toBe(true);
  });

  it("allows edges that keep the graph acyclic", () => {
    const edges = [edge("a", "b"), edge("b", "c")];
    expect(wouldCreateCycle(edges, "a", "c")).toBe(false);
    expect(wouldCreateCycle(edges, "d", "a")).toBe(false);
  });

  it("refuses direct and indirect loops", () => {
    const edges = [edge("a", "b"), edge("b", "c")];
    expect(wouldCreateCycle(edges, "b", "a")).toBe(true);
    expect(wouldCreateCycle(edges, "c", "a")).toBe(true);
  });

  it("handles diamonds", () => {
    const edges = [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")];
    expect(wouldCreateCycle(edges, "d", "a")).toBe(true);
    expect(wouldCreateCycle(edges, "b", "c")).toBe(false);
  });
});
