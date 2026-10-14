/**
 * Task dependencies: "blocker must be done before blocked can start".
 * Adding an edge that would close a loop is refused, so the graph stays a
 * DAG and the project timeline can compute a critical path.
 */
import {
  getDb,
  eq,
  and,
  or,
  inArray,
  tasks,
  taskDependencies,
} from "@open-sunsama/database";
import { ConflictError, NotFoundError, ValidationError } from "@open-sunsama/utils";

type Db = Pick<ReturnType<typeof getDb>, "select" | "insert" | "delete">;

/** What a task response says about a related task. */
export interface DependencyRef {
  id: string;
  title: string;
  completedAt: Date | null;
  scheduledDate: string | null;
  dueDate: string | null;
  projectId: string | null;
}

export interface DependencySummary {
  /** Tasks that must be done first */
  blockedBy: DependencyRef[];
  /** Tasks waiting on this one */
  blocking: DependencyRef[];
}

/**
 * Would adding `blocker → blocked` create a cycle? True when `blocker` is
 * already reachable from `blocked` (or they're the same task).
 */
export function wouldCreateCycle(
  edges: Array<{ blockerTaskId: string; blockedTaskId: string }>,
  blocker: string,
  blocked: string
): boolean {
  if (blocker === blocked) return true;
  const next = new Map<string, string[]>();
  for (const e of edges) {
    next.set(e.blockerTaskId, [...(next.get(e.blockerTaskId) ?? []), e.blockedTaskId]);
  }
  const seen = new Set<string>([blocked]);
  const queue = [blocked];
  while (queue.length) {
    const id = queue.shift()!;
    if (id === blocker) return true;
    for (const n of next.get(id) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return false;
}

const refColumns = {
  id: tasks.id,
  title: tasks.title,
  completedAt: tasks.completedAt,
  scheduledDate: tasks.scheduledDate,
  dueDate: tasks.dueDate,
  projectId: tasks.projectId,
};

/** Map of task ID → blockers and dependents, for the given tasks. */
export async function dependencySummaries(
  taskIds: string[],
  db: Db = getDb()
): Promise<Map<string, DependencySummary>> {
  const byTask = new Map<string, DependencySummary>(
    taskIds.map((id) => [id, { blockedBy: [], blocking: [] }])
  );
  if (taskIds.length === 0) return byTask;

  const edges = await db
    .select({
      blockerTaskId: taskDependencies.blockerTaskId,
      blockedTaskId: taskDependencies.blockedTaskId,
    })
    .from(taskDependencies)
    .where(
      or(
        inArray(taskDependencies.blockedTaskId, taskIds),
        inArray(taskDependencies.blockerTaskId, taskIds)
      )
    );
  if (edges.length === 0) return byTask;

  const relatedIds = [
    ...new Set(edges.flatMap((e) => [e.blockerTaskId, e.blockedTaskId])),
  ];
  const refs = await db.select(refColumns).from(tasks).where(inArray(tasks.id, relatedIds));
  const refById = new Map(refs.map((r) => [r.id, r]));

  for (const e of edges) {
    const blocker = refById.get(e.blockerTaskId);
    const blocked = refById.get(e.blockedTaskId);
    if (blocker) byTask.get(e.blockedTaskId)?.blockedBy.push(blocker);
    if (blocked) byTask.get(e.blockerTaskId)?.blocking.push(blocked);
  }
  return byTask;
}

/** Add `blocker → blocked` for the user's tasks; refuses cycles. */
export async function addDependency(
  userId: string,
  blockedTaskId: string,
  blockerTaskId: string,
  db: Db = getDb()
): Promise<void> {
  const owned = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), inArray(tasks.id, [blockedTaskId, blockerTaskId])));
  for (const id of [blockedTaskId, blockerTaskId]) {
    if (!owned.some((t) => t.id === id)) throw new NotFoundError("Task", id);
  }

  const edges = await db
    .select({
      blockerTaskId: taskDependencies.blockerTaskId,
      blockedTaskId: taskDependencies.blockedTaskId,
    })
    .from(taskDependencies)
    .where(eq(taskDependencies.userId, userId));
  if (edges.some((e) => e.blockerTaskId === blockerTaskId && e.blockedTaskId === blockedTaskId)) {
    throw new ConflictError("That dependency already exists");
  }
  if (wouldCreateCycle(edges, blockerTaskId, blockedTaskId)) {
    throw new ValidationError(
      blockerTaskId === blockedTaskId
        ? "A task can't block itself"
        : "That would make a loop: the other task already waits on this one"
    );
  }

  await db.insert(taskDependencies).values({ userId, blockerTaskId, blockedTaskId });
}

/** Remove `blocker → blocked`. */
export async function removeDependency(
  userId: string,
  blockedTaskId: string,
  blockerTaskId: string,
  db: Db = getDb()
): Promise<void> {
  await db
    .delete(taskDependencies)
    .where(
      and(
        eq(taskDependencies.userId, userId),
        eq(taskDependencies.blockedTaskId, blockedTaskId),
        eq(taskDependencies.blockerTaskId, blockerTaskId)
      )
    );
}

/** IDs of open tasks waiting on `taskId`. */
export async function dependentTaskIds(taskId: string, db: Db = getDb()): Promise<string[]> {
  const rows = await db
    .select({ id: taskDependencies.blockedTaskId })
    .from(taskDependencies)
    .where(eq(taskDependencies.blockerTaskId, taskId));
  return rows.map((r) => r.id);
}
