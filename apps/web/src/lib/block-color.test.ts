import { describe, it, expect } from "vitest";
import { DEFAULT_BLOCK_COLOR, resolveBlockColor } from "./block-color";

const projects = new Map([["p1", { color: "#22C55E" }]]);

describe("resolveBlockColor", () => {
  it("uses the project colour for a default-coloured block of a project task", () => {
    expect(resolveBlockColor({ color: "#3B82F6", task: { projectId: "p1" } }, projects)).toBe("#22C55E");
    expect(resolveBlockColor({ color: null, task: { projectId: "p1" } }, projects)).toBe("#22C55E");
  });

  it("keeps a colour the user picked for the block", () => {
    expect(resolveBlockColor({ color: "#EF4444", task: { projectId: "p1" } }, projects)).toBe("#EF4444");
  });

  it("falls back to the default without a project", () => {
    expect(resolveBlockColor({ color: null, task: null }, projects)).toBe(DEFAULT_BLOCK_COLOR);
    expect(resolveBlockColor({ color: null, task: { projectId: "gone" } }, projects)).toBe(DEFAULT_BLOCK_COLOR);
    expect(resolveBlockColor({ color: null }, projects)).toBe(DEFAULT_BLOCK_COLOR);
  });
});
