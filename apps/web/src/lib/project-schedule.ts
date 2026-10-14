/**
 * Dependency maths for a project's tasks: their order and the columns of
 * the dependency graph.
 *
 * Edges come from each task's `blockedBy`; only edges between tasks in the
 * given list count. The API refuses cycles, but everything here still copes
 * with one (cycle members are simply left out of the ordering maths).
 */

export interface ScheduleTask {
  id: string;
  title: string;
  completedAt: Date | string | null;
  scheduledDate: string | null;
  dueDate: string | null;
  estimatedMins: number | null;
  blockedBy?: Array<{ id: string }>;
}

export interface Edge {
  from: string; // blocker
  to: string; // blocked
}

export const edgeKey = (e: Edge) => `${e.from}>${e.to}`;

/** Dependency edges between tasks in the list. */
export function projectEdges(tasks: ScheduleTask[]): Edge[] {
  const ids = new Set(tasks.map((t) => t.id));
  const edges: Edge[] = [];
  for (const t of tasks) {
    for (const b of t.blockedBy ?? []) {
      if (ids.has(b.id) && b.id !== t.id) edges.push({ from: b.id, to: t.id });
    }
  }
  return edges;
}

const startOf = (t: ScheduleTask) => t.scheduledDate ?? t.dueDate ?? "9999-12-31";

/**
 * Kahn topological order: blockers before what they block; among tasks that
 * are free at the same time, earlier dates first, then title.
 */
export function topologicalOrder(tasks: ScheduleTask[]): string[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const edges = projectEdges(tasks);
  const indegree = new Map(tasks.map((t) => [t.id, 0]));
  const next = new Map<string, string[]>();
  for (const e of edges) {
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
    next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
  }
  const compare = (a: string, b: string) => {
    const ta = byId.get(a)!;
    const tb = byId.get(b)!;
    return startOf(ta).localeCompare(startOf(tb)) || ta.title.localeCompare(tb.title);
  };
  const ready = tasks.filter((t) => indegree.get(t.id) === 0).map((t) => t.id).sort(compare);
  const order: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    order.push(id);
    for (const n of next.get(id) ?? []) {
      indegree.set(n, indegree.get(n)! - 1);
      if (indegree.get(n) === 0) {
        ready.push(n);
        ready.sort(compare);
      }
    }
  }
  // Anything left is in a cycle; append so nothing disappears.
  for (const t of tasks) if (!order.includes(t.id)) order.push(t.id);
  return order;
}

/** Column for each task in the graph: the longest chain of blockers before it. */
export function dependencyLayers(tasks: ScheduleTask[]): Map<string, number> {
  const order = topologicalOrder(tasks);
  const edges = projectEdges(tasks);
  const layer = new Map(order.map((id) => [id, 0]));
  const position = new Map(order.map((id, i) => [id, i]));
  for (const id of order) {
    for (const e of edges) {
      if (e.from === id && position.get(e.to)! > position.get(id)!) {
        layer.set(e.to, Math.max(layer.get(e.to)!, layer.get(id)! + 1));
      }
    }
  }
  return layer;
}

/** A task is blocked while any blocker is still open. */
export function isBlocked(t: { blockedBy?: Array<{ completedAt: unknown }> }): boolean {
  return (t.blockedBy ?? []).some((b) => !b.completedAt);
}
