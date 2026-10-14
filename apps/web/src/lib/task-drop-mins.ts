import type { QueryClient } from "@tanstack/react-query";
import type { Task, TimeBlock } from "@open-sunsama/types";
import { differenceInMinutes } from "date-fns";
import { timeBlockKeys } from "@/lib/query-keys";

/**
 * Length of a new block for a task dropped on the calendar. A task that's
 * already blocked gets another block the size of its latest one; its
 * planned time is then the total of its blocks, so sizing by that would
 * double each repeat. Otherwise the planned time, or `fallback`.
 */
export function taskDropMins(
  queryClient: QueryClient,
  task: Pick<Task, "id" | "estimatedMins">,
  fallback: number
): number {
  let latest: TimeBlock | undefined;
  for (const [, blocks] of queryClient.getQueriesData<TimeBlock[]>({
    queryKey: timeBlockKeys.lists(),
  })) {
    for (const block of blocks ?? []) {
      if (block.taskId !== task.id || block.subtaskId) continue;
      if (!latest || new Date(block.createdAt) > new Date(latest.createdAt)) latest = block;
    }
  }
  if (latest) {
    const mins = differenceInMinutes(new Date(latest.endTime), new Date(latest.startTime));
    if (mins > 0) return mins;
  }
  return task.estimatedMins ?? fallback;
}
