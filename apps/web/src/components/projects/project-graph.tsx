import * as React from "react";
import { Check, Lock } from "lucide-react";
import type { Project, Task, TaskDependencyRef } from "@open-sunsama/types";
import { cn, formatDuration } from "@/lib/utils";
import {
  dependencyLayers,
  edgeKey,
  isBlocked,
  projectEdges,
  topologicalOrder,
  type ScheduleTask,
} from "@/lib/project-schedule";
import { DueBadge } from "@/components/tasks/due-badge";

const NODE_W = 208;
const NODE_H = 52;
const COL_GAP = 72;
const ROW_GAP = 14;
const PAD = 16;

type GraphNode = ScheduleTask & {
  /** A blocker from outside this project */
  external?: boolean;
  task?: Task;
};

interface GraphProps {
  project: Project;
  tasks: Task[];
  onSelect: (task: Task) => void;
  onOpenExternal: (taskId: string) => void;
}

/**
 * Dependency graph of a project, left to right: each column holds tasks
 * whose longest chain of blockers is the same length. Blockers from other
 * projects appear as dashed nodes.
 * Tasks with no dependencies are listed underneath rather than drawn.
 */
export function ProjectGraph({ project, tasks, onSelect, onOpenExternal }: GraphProps) {
  const { nodes, edges, unconnected } = React.useMemo(() => {
    const ids = new Set(tasks.map((t) => t.id));
    const external = new Map<string, TaskDependencyRef>();
    for (const t of tasks) for (const b of t.blockedBy ?? []) if (!ids.has(b.id)) external.set(b.id, b);

    const all: GraphNode[] = [
      ...tasks.map((t) => ({ ...t, task: t })),
      ...[...external.values()].map((b) => ({
        id: b.id,
        title: b.title,
        completedAt: b.completedAt,
        scheduledDate: b.scheduledDate,
        dueDate: b.dueDate,
        estimatedMins: null,
        blockedBy: [],
        external: true,
      })),
    ];
    const allEdges = projectEdges(all);
    const connected = new Set(allEdges.flatMap((e) => [e.from, e.to]));
    return {
      nodes: all.filter((n) => connected.has(n.id)),
      edges: allEdges,
      unconnected: tasks.filter((t) => !connected.has(t.id)),
    };
  }, [tasks]);

  // Columns by dependency depth; within a column, order by the average row
  // of each node's blockers so arrows cross less.
  const layout = React.useMemo(() => {
    const layers = dependencyLayers(nodes);
    const topo = topologicalOrder(nodes);
    const columns: string[][] = [];
    for (const id of topo) {
      const l = layers.get(id) ?? 0;
      (columns[l] ??= []).push(id);
    }
    const row = new Map<string, number>();
    columns.forEach((col, ci) => {
      if (ci > 0) {
        const score = (id: string) => {
          const preds = edges.filter((e) => e.to === id && row.has(e.from)).map((e) => row.get(e.from)!);
          return preds.length ? preds.reduce((a, b) => a + b, 0) / preds.length : Number.MAX_SAFE_INTEGER;
        };
        col.sort((a, b) => score(a) - score(b));
      }
      col.forEach((id, ri) => row.set(id, ri));
    });
    const pos = new Map<string, { x: number; y: number }>();
    columns.forEach((col, ci) =>
      col.forEach((id, ri) =>
        pos.set(id, { x: PAD + ci * (NODE_W + COL_GAP), y: PAD + ri * (NODE_H + ROW_GAP) })
      )
    );
    const width = PAD * 2 + columns.length * NODE_W + Math.max(0, columns.length - 1) * COL_GAP;
    const height = PAD * 2 + Math.max(0, ...columns.map((c) => c.length)) * (NODE_H + ROW_GAP) - ROW_GAP;
    return { pos, width, height };
  }, [nodes, edges]);

  return (
    <div className="space-y-3">
      {nodes.length === 0 ? (
        <p className="px-1 py-4 text-[13px] text-muted-foreground">
          No dependencies yet. Open a task and use “Add a task this waits on” to link tasks.
        </p>
      ) : (
        <div className="overflow-auto rounded-lg border border-border/60 bg-background">
          <div className="relative" style={{ width: layout.width, height: layout.height }}>
            <svg className="pointer-events-none absolute inset-0" width={layout.width} height={layout.height}>
              <defs>
                <marker id="gr-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" className="fill-muted-foreground/60" />
                </marker>
              </defs>
              {edges.map((e) => {
                const a = layout.pos.get(e.from);
                const b = layout.pos.get(e.to);
                if (!a || !b) return null;
                const sx = a.x + NODE_W;
                const sy = a.y + NODE_H / 2;
                const tx = b.x - 2;
                const ty = b.y + NODE_H / 2;
                const bend = Math.max(24, (tx - sx) / 2);
                return (
                  <path
                    key={edgeKey(e)}
                    d={`M${sx},${sy} C${sx + bend},${sy} ${tx - bend},${ty} ${tx},${ty}`}
                    fill="none"
                    strokeWidth={1.25}
                    className="stroke-muted-foreground/50"
                    markerEnd="url(#gr-arrow)"
                  />
                );
              })}
            </svg>

            {nodes.map((n) => {
              const p = layout.pos.get(n.id)!;
              const done = !!n.completedAt;
              const blocked = !done && n.task && isBlocked(n.task);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => (n.task ? onSelect(n.task) : onOpenExternal(n.id))}
                  className={cn(
                    "absolute flex flex-col justify-center gap-0.5 rounded-lg border bg-card px-2.5 text-left shadow-card transition-shadow hover:shadow-card-hover",
                    n.external && "border-dashed bg-transparent shadow-none",
                    done && "opacity-50"
                  )}
                  style={{
                    left: p.x,
                    top: p.y,
                    width: NODE_W,
                    height: NODE_H,
                    borderLeftWidth: n.external ? undefined : 3,
                    borderLeftColor: n.external ? undefined : project.color,
                  }}
                  title={n.title}
                >
                  <span className={cn("flex min-w-0 items-center gap-1.5 text-[13px] leading-5", done && "line-through")}>
                    {done && <Check className="h-3 w-3 shrink-0 text-emerald-500" strokeWidth={3} />}
                    {blocked && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                    <span className="truncate">{n.title}</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2 text-[11px] leading-4 text-muted-foreground">
                    {n.external ? (
                      <span>Other project</span>
                    ) : (
                      <>
                        {n.estimatedMins ? <span className="tabular-nums">{formatDuration(n.estimatedMins)}</span> : null}
                        <DueBadge dueDate={n.dueDate} completed={done} />
                        {!n.dueDate && n.scheduledDate && <span>Starts {n.scheduledDate.slice(5)}</span>}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {unconnected.length > 0 && nodes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {unconnected.length} task{unconnected.length === 1 ? " has" : "s have"} no dependencies and{" "}
          {unconnected.length === 1 ? "isn't" : "aren't"} shown.
        </p>
      )}
    </div>
  );
}
