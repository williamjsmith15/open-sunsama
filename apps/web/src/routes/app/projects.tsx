import * as React from "react";
import { useSearch } from "@tanstack/react-router";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Inbox,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { Project, ProjectStatus, Task } from "@open-sunsama/types";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useDeleteProject, useProjects, useUpdateProject } from "@/hooks/useProjects";
import { useCompleteTask, useCreateTask, useTasks } from "@/hooks/useTasks";
import { TaskModal } from "@/components/kanban/task-modal.lazy";
import { TaskRow } from "@/components/tasks/task-row";
import {
  TagFilter,
  matchesTagFilter,
  type TagFilterValue,
} from "@/components/tags/tag-picker";
import { BoardIcon } from "@/components/ideas/board-icon";
import {
  NO_PROJECT,
  ProjectRailList,
  type ProjectSelection,
} from "@/components/projects/project-rail";
import {
  PROJECT_STATUS_LABELS,
  ProjectDialog,
} from "@/components/projects/project-dialog";
import { ProjectGraph } from "@/components/projects/project-graph";
import { ProjectTime } from "@/components/projects/project-time";
import { useLinkChain, useUnlinkTasks } from "@/hooks/useDependencies";
import { openTask } from "@/lib/open-task";

type ProjectView = "list" | "graph";
const PROJECT_VIEW_KEY = "open-sunsama-projects-view";
const PROJECT_VIEWS: Array<{ id: ProjectView; label: string }> = [
  { id: "list", label: "List" },
  { id: "graph", label: "Graph" },
];

function readView(): ProjectView {
  try {
    const v = localStorage.getItem(PROJECT_VIEW_KEY);
    return v === "graph" ? v : "list";
  } catch {
    return "list";
  }
}

const ACTIVE_PROJECT_KEY = "open-sunsama-projects-active";

function readStored(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

function store(id: string) {
  try {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } catch {
    // selection just isn't remembered
  }
}

interface Section {
  key: string;
  label: string;
  tasks: Task[];
  tone?: "overdue";
  collapsedByDefault?: boolean;
}

/** Overdue, Today, Tomorrow, each later day, Backlog, then Completed. */
function groupProjectTasks(tasks: Task[]): Section[] {
  const today = format(new Date(), "yyyy-MM-dd");
  const byPosition = (a: Task, b: Task) =>
    a.position - b.position || a.priority.localeCompare(b.priority);

  const open = tasks.filter((t) => !t.completedAt);
  const overdue = open.filter((t) => t.scheduledDate && t.scheduledDate < today);
  const backlog = open.filter((t) => !t.scheduledDate);
  const upcoming = new Map<string, Task[]>();
  for (const t of open) {
    if (!t.scheduledDate || t.scheduledDate < today) continue;
    upcoming.set(t.scheduledDate, [...(upcoming.get(t.scheduledDate) ?? []), t]);
  }
  const completed = tasks
    .filter((t) => t.completedAt)
    .sort(
      (a, b) =>
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
    );

  const sections: Section[] = [];
  if (overdue.length)
    sections.push({
      key: "overdue",
      label: "Overdue",
      tasks: overdue.sort(
        (a, b) => a.scheduledDate!.localeCompare(b.scheduledDate!) || byPosition(a, b)
      ),
      tone: "overdue",
    });
  for (const date of [...upcoming.keys()].sort()) {
    const d = parseISO(date);
    const label = isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEE, MMM d");
    sections.push({ key: date, label, tasks: upcoming.get(date)!.sort(byPosition) });
  }
  if (backlog.length)
    sections.push({ key: "backlog", label: "Backlog", tasks: backlog.sort(byPosition) });
  if (completed.length)
    sections.push({
      key: "completed",
      label: "Completed",
      tasks: completed,
      collapsedByDefault: true,
    });
  return sections;
}

function TaskSection({
  section,
  onSelect,
  onComplete,
  hideProject,
  pickOrder,
  onPick,
}: {
  section: Section;
  onSelect: (task: Task) => void;
  onComplete: (task: Task) => void;
  hideProject: boolean;
  /** While picking tasks to link: each picked task's place in the chain */
  pickOrder?: Map<string, number>;
  onPick?: (task: Task, range: boolean) => void;
}) {
  const [expanded, setExpanded] = React.useState(!section.collapsedByDefault);
  return (
    <div className="mb-4">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors hover:bg-accent/40",
          section.tone === "overdue" && "text-red-500"
        )}
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90"
          )}
        />
        {section.label}
        <span className="text-[11px] font-normal tabular-nums text-muted-foreground">
          {section.tasks.length}
        </span>
      </button>
      {expanded &&
        section.tasks.map((task) => {
          const row = (
            <TaskRow
              key={task.id}
              task={task}
              hideProject={hideProject}
              onSelect={() => onSelect(task)}
              onComplete={() => onComplete(task)}
            />
          );
          if (!onPick) return row;
          const place = pickOrder?.get(task.id);
          // Picking: the whole row picks the task; its number is its place.
          return (
            <div key={task.id} className={cn("relative rounded-md", place && "bg-primary/5")}>
              {row}
              <button
                type="button"
                aria-pressed={!!place}
                aria-label={place ? `Step ${place}: ${task.title}` : `Pick ${task.title}`}
                onClick={(e) => onPick(task, e.shiftKey)}
                className="absolute inset-0 z-10 flex items-center rounded-md pl-0.5 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                    place
                      ? "bg-primary text-primary-foreground"
                      : "border border-dashed border-muted-foreground/50 bg-background"
                  )}
                >
                  {place ?? ""}
                </span>
              </button>
            </div>
          );
        })}
    </div>
  );
}

function ProjectHeader({
  project,
  tasks,
  onEdit,
}: {
  project: Project;
  tasks: Task[];
  onEdit: () => void;
}) {
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const total = tasks.length;
  const done = tasks.filter((t) => t.completedAt).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const today = format(new Date(), "yyyy-MM-dd");
  const overdueCount = tasks.filter(
    (t) => !t.completedAt && t.dueDate && t.dueDate < today
  ).length;
  const overdueTarget =
    project.targetDate && project.targetDate < today && project.status === "active";

  const setStatus = (status: ProjectStatus) =>
    updateProject.mutate({ id: project.id, input: { status } });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <BoardIcon icon={project.icon} color={project.color} size={28} />
        <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight">
          {project.name}
        </h1>
        {project.status !== "active" && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {PROJECT_STATUS_LABELS[project.status]}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Project actions"
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[])
              .filter((s) => s !== project.status)
              .map((s) => (
                <DropdownMenuItem key={s} onClick={() => setStatus(s)}>
                  Mark {PROJECT_STATUS_LABELS[s].toLowerCase()}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete “${project.name}”? Its tasks are kept and become unassigned.`
                  )
                ) {
                  deleteProject.mutate(project.id);
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="tabular-nums">
            {done}/{total} done
          </span>
        </span>
        {overdueCount > 0 && (
          <span className="text-red-500">
            {overdueCount} overdue
          </span>
        )}
        {project.targetDate && (
          <span className={cn(overdueTarget && "text-red-500")}>
            Target {format(parseISO(project.targetDate), "EEE, MMM d")}
          </span>
        )}
      </div>

      <ProjectTime project={project} />

      {project.description && (
        <p className="max-w-2xl whitespace-pre-wrap text-[13px] text-muted-foreground">
          {project.description}
        </p>
      )}
    </div>
  );
}

function QuickAdd({ projectId }: { projectId: string | null }) {
  const createTask = useCreateTask();
  const [title, setTitle] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = title.trim();
        if (!trimmed) return;
        createTask.mutate({ title: trimmed, projectId: projectId ?? undefined });
        setTitle("");
      }}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground focus-within:bg-surface hover:bg-surface"
    >
      <Plus className="ml-4 h-4 w-4 shrink-0" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={projectId ? "Add a task to this project…" : "Add a task…"}
        maxLength={500}
        className="min-w-0 flex-1 bg-transparent text-foreground outline-hidden placeholder:text-muted-foreground"
      />
    </form>
  );
}

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const { project: projectParam } = useSearch({ strict: false }) as { project?: string };
  const [selected, setSelected] = React.useState<ProjectSelection | null>(
    () => projectParam ?? readStored()
  );
  const [newOpen, setNewOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const completeTask = useCompleteTask();
  const [tagFilter, setTagFilter] = React.useState<TagFilterValue>(null);
  // Picking tasks to link in order (List view of a project).
  const [picking, setPicking] = React.useState(false);
  const [picked, setPicked] = React.useState<string[]>([]);
  const pickAnchor = React.useRef<string | null>(null);
  const linkChain = useLinkChain();
  const unlinkTasks = useUnlinkTasks();
  const stopPicking = () => {
    setPicking(false);
    setPicked([]);
    pickAnchor.current = null;
  };
  const [view, setViewState] = React.useState<ProjectView>(readView);
  const setView = (v: ProjectView) => {
    setViewState(v);
    try {
      localStorage.setItem(PROJECT_VIEW_KEY, v);
    } catch {
      // view just isn't remembered
    }
  };

  React.useEffect(() => {
    if (projectParam) setSelected(projectParam);
  }, [projectParam]);

  // Keep a valid selection as projects load or get deleted.
  React.useEffect(() => {
    if (!projects) return;
    const valid =
      selected === NO_PROJECT || (selected && projects.some((p) => p.id === selected));
    if (!valid) {
      const first = projects.find((p) => p.status === "active") ?? projects[0];
      setSelected(first?.id ?? NO_PROJECT);
    }
  }, [projects, selected]);

  const select = React.useCallback((id: ProjectSelection) => {
    setPicking(false);
    setPicked([]);
    setSelected(id);
    store(id);
    setSheetOpen(false);
  }, []);

  const { data: tasks = [], isLoading: tasksLoading } = useTasks(
    selected ? { projectId: selected, limit: 1000 } : undefined
  );
  const sections = React.useMemo(
    () => groupProjectTasks(tasks.filter((t) => matchesTagFilter(t, tagFilter))),
    [tasks, tagFilter]
  );
  const project =
    selected && selected !== NO_PROJECT
      ? projects?.find((p) => p.id === selected)
      : undefined;

  const listOrder = React.useMemo(() => sections.flatMap((s) => s.tasks), [sections]);
  const pickOrder = React.useMemo(
    () => new Map(picked.map((id, i) => [id, i + 1])),
    [picked]
  );
  // Click adds (or removes) one task at the end of the chain; shift-click
  // adds every task from the last one clicked down to this one.
  const pick = (task: Task, range: boolean) => {
    const anchor = pickAnchor.current;
    if (range && anchor && anchor !== task.id) {
      const from = listOrder.findIndex((t) => t.id === anchor);
      const to = listOrder.findIndex((t) => t.id === task.id);
      if (from !== -1 && to !== -1) {
        const step = from < to ? 1 : -1;
        const run: string[] = [];
        for (let i = from + step; i !== to + step; i += step) run.push(listOrder[i]!.id);
        setPicked((prev) => [...prev, ...run.filter((id) => !prev.includes(id))]);
        pickAnchor.current = task.id;
        return;
      }
    }
    setPicked((prev) =>
      prev.includes(task.id) ? prev.filter((id) => id !== task.id) : [...prev, task.id]
    );
    pickAnchor.current = task.id;
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const railList = (
    <ProjectRailList
      projects={projects ?? []}
      selected={selected}
      onSelect={select}
      onNewProject={() => {
        setSheetOpen(false);
        setNewOpen(true);
      }}
    />
  );

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-background p-2.5 lg:flex">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Projects
          </span>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            title="New project"
            aria-label="New project"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {railList}
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        {/* Mobile project switcher */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 lg:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Switch project"
                className="-ml-1.5 flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted"
              >
                {project ? (
                  <BoardIcon icon={project.icon} color={project.color} size={22} />
                ) : (
                  <Inbox className="h-4 w-4" />
                )}
                <span className="min-w-0 truncate text-base font-semibold">
                  {project?.name ?? "No project"}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col p-3">
              <SheetHeader className="mb-3">
                <SheetTitle className="text-left">Projects</SheetTitle>
              </SheetHeader>
              {railList}
            </SheetContent>
          </Sheet>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className={cn(
              "mx-auto w-full px-4 py-5 lg:px-6",
              project && view !== "list" ? "max-w-none" : "max-w-3xl"
            )}
          >
            {project ? (
              <ProjectHeader project={project} tasks={tasks} onEdit={() => setEditOpen(true)} />
            ) : selected === NO_PROJECT ? (
              <div className="space-y-1">
                <h1 className="text-lg font-semibold tracking-tight">No project</h1>
                <p className="text-[13px] text-muted-foreground">
                  Tasks that aren't in a project yet. Right-click a task, or open it, to
                  move it into one.
                </p>
              </div>
            ) : null}

            {projects?.length === 0 && selected === NO_PROJECT && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-border p-4">
                <FolderKanban className="h-5 w-5 shrink-0 text-muted-foreground" />
                <p className="flex-1 text-[13px] text-muted-foreground">
                  Group related tasks into a project to track them to done.
                </p>
                <Button size="sm" onClick={() => setNewOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New project
                </Button>
              </div>
            )}

            {project && (
              <div className="mt-4 flex items-center gap-0.5 self-start rounded-md bg-muted/50 p-0.5 w-fit">
                {PROJECT_VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={view === v.id}
                    onClick={() => setView(v.id)}
                    className={cn(
                      "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                      view === v.id
                        ? "bg-surface text-foreground shadow-card"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}

            {project && view === "graph" ? (
              <div className="mt-4">
                <ProjectGraph
                  project={project}
                  tasks={tasks.filter((t) => matchesTagFilter(t, tagFilter))}
                  onSelect={setSelectedTask}
                  onOpenExternal={openTask}
                />
              </div>
            ) : (
            <div className="mt-5">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <QuickAdd projectId={project?.id ?? null} />
                </div>
                <TagFilter value={tagFilter} onChange={setTagFilter} />
                {project && !picking && (
                  <button
                    type="button"
                    onClick={() => setPicking(true)}
                    title="Pick tasks in the order they happen, then link them"
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Link tasks
                  </button>
                )}
              </div>
              {picking && (
                <div className="sticky top-0 z-20 mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2 text-xs shadow-card">
                  <span className="min-w-0 flex-1 text-muted-foreground">
                    {picked.length === 0
                      ? "Click tasks in the order they happen. Shift-click picks a range."
                      : `${picked.length} picked: each will wait on the one before it.`}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      setPicked(listOrder.filter((t) => !t.completedAt).map((t) => t.id));
                      pickAnchor.current = null;
                    }}
                  >
                    All open, in list order
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={picked.length < 2 || unlinkTasks.isPending}
                    onClick={() => unlinkTasks.mutate(picked, { onSuccess: stopPicking })}
                  >
                    Unlink
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={picked.length < 2 || linkChain.isPending}
                    onClick={() => linkChain.mutate(picked, { onSuccess: stopPicking })}
                  >
                    Link in order
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={stopPicking}>
                    Cancel
                  </Button>
                </div>
              )}
              {tasksLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : sections.length === 0 ? (
                <p className="px-3 py-6 text-[13px] text-muted-foreground">
                  No tasks yet.
                </p>
              ) : (
                <div className="mt-3">
                  {sections.map((section) => (
                    <TaskSection
                      key={`${selected}-${section.key}`}
                      section={section}
                      hideProject={!!project}
                      pickOrder={picking ? pickOrder : undefined}
                      onPick={picking ? pick : undefined}
                      onSelect={setSelectedTask}
                      onComplete={(task) =>
                        completeTask.mutate({ id: task.id, completed: !task.completedAt })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </main>

      <TaskModal
        task={selectedTask}
        open={selectedTask !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null);
        }}
      />
      <ProjectDialog open={newOpen} onOpenChange={setNewOpen} onCreated={select} />
      <ProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
    </div>
  );
}
