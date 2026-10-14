import type { Project, TimeBlock } from "@open-sunsama/types";

/** Colour a time block gets when nobody picked one. */
export const DEFAULT_BLOCK_COLOR = "#3B82F6";

/**
 * A block linked to a task in a project shows the project's colour, unless
 * the block was given its own (non-default) colour.
 */
export function resolveBlockColor(
  block: Pick<TimeBlock, "color"> & { task?: { projectId?: string | null } | null },
  projects: Map<string, Pick<Project, "color">>
): string {
  const own =
    block.color && block.color.toUpperCase() !== DEFAULT_BLOCK_COLOR ? block.color : null;
  if (own) return own;
  const projectId = block.task?.projectId;
  return (projectId && projects.get(projectId)?.color) || DEFAULT_BLOCK_COLOR;
}
