import * as React from "react";
import { Check, FolderKanban, Plus, Search, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import type { Project } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import { useCreateProject, useProjects } from "@/hooks/useProjects";
import { COLOR_OPTIONS } from "@/components/calendar/time-block-form-sections";

/** A project's colour dot. */
export function ProjectDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}

/** Compact "● Name" label for cards and rows. */
export function ProjectChip({
  project,
  className,
}: {
  project: Pick<Project, "name" | "color">;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-[10rem] items-center gap-1 text-[11px] leading-4 text-muted-foreground",
        className
      )}
      title={project.name}
    >
      <ProjectDot color={project.color} className="h-1.5 w-1.5" />
      <span className="truncate">{project.name}</span>
    </span>
  );
}

interface ProjectMenuProps {
  value: string | null;
  onChange: (projectId: string | null) => void;
}

/**
 * Searchable project list for popovers and menus: "No project", the user's
 * open projects, and "Create" for a name that doesn't exist yet. Archived and
 * completed projects only show while searching or when already selected.
 */
export function ProjectMenu({ value, onChange }: ProjectMenuProps) {
  const { data: projects = [] } = useProjects();
  const createProject = useCreateProject();
  const [query, setQuery] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // Popover content mounts before it's positioned; focus on the next frame.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const q = query.trim().toLowerCase();
  const visible = projects.filter((p) =>
    q
      ? p.name.toLowerCase().includes(q)
      : p.id === value || p.status === "active" || p.status === "on_hold"
  );
  const exact = projects.some((p) => p.name.toLowerCase() === q);
  const canCreate = q.length > 0 && !exact;

  type Row = { kind: "none" } | { kind: "project"; project: Project } | { kind: "create" };
  const rows: Row[] = [
    ...(q ? [] : [{ kind: "none" } as Row]),
    ...visible.map((project) => ({ kind: "project", project }) as Row),
    ...(canCreate ? [{ kind: "create" } as Row] : []),
  ];

  React.useEffect(() => setHighlight(0), [query]);

  const choose = async (row: Row) => {
    if (row.kind === "none") onChange(null);
    else if (row.kind === "project") onChange(row.project.id);
    else {
      const color =
        COLOR_OPTIONS[projects.length % COLOR_OPTIONS.length]?.value ?? "#6366F1";
      const created = await createProject.mutateAsync({ name: query.trim(), color });
      onChange(created.id);
    }
  };

  return (
    <div
      className="w-60 p-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlight((h) => Math.min(h + 1, rows.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlight((h) => Math.max(h - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          const row = rows[highlight];
          if (row) void choose(row);
        }
        // Keep task shortcuts (0–3, D, etc.) from firing while typing here.
        e.stopPropagation();
      }}
    >
      <div className="flex items-center gap-1.5 border-b border-border/60 px-2 pb-1.5 pt-1">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Move to project…"
          maxLength={120}
          className="h-6 min-w-0 flex-1 bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
        />
      </div>
      <div role="listbox" aria-label="Project" className="max-h-64 overflow-y-auto pt-1">
        {rows.map((row, i) => {
          const selected =
            (row.kind === "none" && value === null) ||
            (row.kind === "project" && row.project.id === value);
          return (
            <button
              key={row.kind === "project" ? row.project.id : row.kind}
              type="button"
              role="option"
              aria-selected={selected}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => void choose(row)}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors focus:outline-hidden",
                i === highlight && "bg-accent"
              )}
            >
              {row.kind === "none" && (
                <>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 text-muted-foreground">No project</span>
                </>
              )}
              {row.kind === "project" && (
                <>
                  <ProjectDot color={row.project.color} />
                  <span className="min-w-0 flex-1 truncate">{row.project.name}</span>
                  {row.project.status !== "active" && (
                    <span className="text-[11px] text-muted-foreground">
                      {row.project.status.replace("_", " ")}
                    </span>
                  )}
                </>
              )}
              {row.kind === "create" && (
                <>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    Create “{query.trim()}”
                  </span>
                </>
              )}
              {selected && <Check className="h-3.5 w-3.5" />}
            </button>
          );
        })}
        {rows.length === 0 && (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No projects</p>
        )}
      </div>
    </div>
  );
}

/** View filter: null shows everything, "none" tasks without a project. */
export type ProjectFilterValue = string | null;

export function matchesProjectFilter(
  task: { projectId?: string | null },
  filter: ProjectFilterValue
): boolean {
  if (filter === null) return true;
  if (filter === "none") return !task.projectId;
  return task.projectId === filter;
}

/** Toolbar control that narrows a view to one project. */
export function ProjectFilter({
  value,
  onChange,
}: {
  value: ProjectFilterValue;
  onChange: (value: ProjectFilterValue) => void;
}) {
  const { data: projects = [], isSuccess } = useProjects();
  // A remembered filter for a project that has since been deleted shows all.
  React.useEffect(() => {
    if (isSuccess && value && value !== "none" && !projects.some((p) => p.id === value)) {
      onChange(null);
    }
  }, [isSuccess, value, projects, onChange]);
  const current = value && value !== "none" ? projects.find((p) => p.id === value) : undefined;
  const label = value === null ? "All projects" : value === "none" ? "No project" : current?.name ?? "Project";
  const open = projects.filter(
    (p) => p.id === value || p.status === "active" || p.status === "on_hold"
  );
  const item =
    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus:bg-accent focus:outline-hidden";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Project filter: ${label}`}
          className={cn(
            "flex h-8 max-w-[11rem] items-center gap-1.5 rounded-md px-2 text-xs transition-colors hover:bg-accent",
            value === null ? "text-muted-foreground" : "bg-accent text-foreground"
          )}
        >
          {current ? (
            <ProjectDot color={current.color} />
          ) : (
            <FolderKanban className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{label}</span>
          {value !== null && (
            <span
              role="button"
              aria-label="Clear project filter"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onChange(null);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="-mr-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto p-1">
        <DropdownMenuItem className={item} onClick={() => onChange(null)}>
          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1">All projects</span>
          {value === null && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onClick={() => onChange("none")}>
          <X className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1">No project</span>
          {value === "none" && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>
        {open.length > 0 && <div className="my-1 h-px bg-border/60" />}
        {open.map((p) => (
          <DropdownMenuItem key={p.id} className={item} onClick={() => onChange(p.id)}>
            <ProjectDot color={p.color} />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            {value === p.id && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
