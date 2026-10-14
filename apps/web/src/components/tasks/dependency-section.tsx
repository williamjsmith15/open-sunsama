import * as React from "react";
import { Check, Link2, Plus, Search, X } from "lucide-react";
import type { Task, TaskDependencyRef } from "@open-sunsama/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useSearchTasks } from "@/hooks/useSearchTasks";
import { useAddDependency, useRemoveDependency } from "@/hooks/useDependencies";
import { useProjectMap } from "@/hooks/useProjects";
import { ProjectDot } from "@/components/projects/project-picker";

function RefRow({
  dep,
  onOpen,
  onRemove,
}: {
  dep: TaskDependencyRef;
  onOpen?: (id: string) => void;
  onRemove?: () => void;
}) {
  const projects = useProjectMap();
  const project = dep.projectId ? projects.get(dep.projectId) : undefined;
  const done = !!dep.completedAt;
  return (
    <div className="group flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent/50">
      <span
        className={cn(
          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
          done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40"
        )}
      >
        {done && <Check className="h-2 w-2" strokeWidth={3} />}
      </span>
      <button
        type="button"
        onClick={() => onOpen?.(dep.id)}
        className={cn(
          "min-w-0 flex-1 truncate text-left",
          done && "text-muted-foreground line-through",
          onOpen && "hover:underline"
        )}
      >
        {dep.title}
      </button>
      {project && <ProjectDot color={project.color} />}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${dep.title}`}
          onClick={onRemove}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground focus:opacity-100 group-hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function AddBlocker({ task }: { task: Task }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const addDependency = useAddDependency();
  const { data: results = [] } = useSearchTasks({ query, status: "all", limit: 20 });
  const exclude = new Set([task.id, ...(task.blockedBy ?? []).map((b) => b.id)]);
  const options = results.filter((t) => !exclude.has(t.id)).slice(0, 8);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add a task this waits on
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1" onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 border-b border-border/60 px-2 pb-1.5 pt-1">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            className="h-6 min-w-0 flex-1 bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto pt-1">
          {options.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                addDependency.mutate({ taskId: task.id, blockerTaskId: t.id });
                setOpen(false);
                setQuery("");
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className={cn("min-w-0 flex-1 truncate", t.completedAt && "text-muted-foreground line-through")}>
                {t.title}
              </span>
              {t.scheduledDate && (
                <span className="shrink-0 text-xs text-muted-foreground">{t.scheduledDate.slice(5)}</span>
              )}
            </button>
          ))}
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              {query ? "No matching tasks" : "Type to search"}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Task editor section: what this task waits on (editable) and what waits on
 * it. Clicking a task opens it via `onOpenTask`.
 */
export function DependencySection({
  task,
  onOpenTask,
}: {
  task: Task;
  onOpenTask?: (id: string) => void;
}) {
  const removeDependency = useRemoveDependency();
  const blockedBy = task.blockedBy ?? [];
  const blocking = task.blocking ?? [];

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          <Link2 className="h-3 w-3" />
          Waits on
        </p>
        {blockedBy.map((dep) => (
          <RefRow
            key={dep.id}
            dep={dep}
            onOpen={onOpenTask}
            onRemove={() => removeDependency.mutate({ taskId: task.id, blockerTaskId: dep.id })}
          />
        ))}
        <AddBlocker task={task} />
      </div>
      {blocking.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Blocks
          </p>
          {blocking.map((dep) => (
            <RefRow key={dep.id} dep={dep} onOpen={onOpenTask} />
          ))}
        </div>
      )}
    </div>
  );
}
