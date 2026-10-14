/**
 * "Schedule" order for a day's tasks: tasks with no time block first, in
 * their manual order, then the time-blocked ones by their earliest block's
 * start (manual order breaks ties).
 */
export function orderBySchedule<T extends { id: string; position: number }>(
  tasks: T[],
  blockStartByTaskId: Map<string, Date>
): T[] {
  return [...tasks].sort((a, b) => {
    const sa = blockStartByTaskId.get(a.id);
    const sb = blockStartByTaskId.get(b.id);
    if (!sa !== !sb) return sa ? 1 : -1;
    if (sa && sb && sa.getTime() !== sb.getTime()) return sa.getTime() - sb.getTime();
    return a.position - b.position;
  });
}
