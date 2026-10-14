import * as React from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, Inbox, Plus } from "lucide-react";
import type { Project } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import { useReorderProjects } from "@/hooks/useProjects";
import { BoardIcon } from "@/components/ideas/board-icon";

/** Rail selection: a project id, or "none" for tasks without a project. */
export type ProjectSelection = string;
export const NO_PROJECT = "none";

interface ProjectRowProps {
  project: Project;
  isActive: boolean;
  sortable: boolean;
  onSelect: (id: string) => void;
}

function ProjectRow({ project, isActive, sortable: enabled, onSelect }: ProjectRowProps) {
  const sortable = useSortable({ id: project.id, disabled: !enabled });
  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      {...sortable.attributes}
      {...sortable.listeners}
      onClick={() => {
        if (!sortable.isDragging) onSelect(project.id);
      }}
      className={cn(
        "group relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
        isActive ? "bg-muted font-semibold" : "text-foreground hover:bg-muted",
        project.status !== "active" && !isActive && "text-muted-foreground",
        sortable.isDragging && "z-10 opacity-80 shadow-md ring-1 ring-border"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" />
      )}
      <BoardIcon icon={project.icon} color={project.color} size={20} />
      <span className="min-w-0 flex-1 truncate">{project.name}</span>
      {(project.openTaskCount ?? 0) > 0 && (
        <span className="text-[11px] font-normal tabular-nums text-muted-foreground">
          {project.openTaskCount}
        </span>
      )}
    </div>
  );
}

interface ProjectRailListProps {
  projects: Project[];
  selected: ProjectSelection | null;
  onSelect: (id: ProjectSelection) => void;
  onNewProject: () => void;
  /** Tasks with no project, shown on the "No project" row */
  unassignedCount?: number;
}

/**
 * The project list: "No project", then open projects (drag to reorder), then
 * finished ones in a collapsed group. Shared by the desktop rail and the
 * mobile sheet.
 */
export function ProjectRailList({
  projects,
  selected,
  onSelect,
  onNewProject,
  unassignedCount,
}: ProjectRailListProps) {
  const reorder = useReorderProjects();
  const [showDone, setShowDone] = React.useState(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const open = projects.filter((p) => p.status === "active" || p.status === "on_hold");
  const done = projects.filter((p) => p.status === "completed" || p.status === "archived");

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Reorder within the open group; finished projects keep their slots after it.
    const ids = open.map((p) => p.id);
    const from = ids.indexOf(active.id as string);
    const to = ids.indexOf(over.id as string);
    if (from === -1 || to === -1) return;
    reorder.mutate([...arrayMove(ids, from, to), ...done.map((p) => p.id)]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
      <div
        onClick={() => onSelect(NO_PROJECT)}
        className={cn(
          "relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
          selected === NO_PROJECT ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted"
        )}
      >
        {selected === NO_PROJECT && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" />
        )}
        <span className="grid h-5 w-5 place-items-center">
          <Inbox className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1">No project</span>
        {!!unassignedCount && (
          <span className="text-[11px] font-normal tabular-nums">{unassignedCount}</span>
        )}
      </div>

      <div className="my-1 h-px bg-border/60" />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={open.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {open.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              isActive={selected === project.id}
              sortable={open.length > 1}
              onSelect={onSelect}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={onNewProject}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <span className="grid h-5 w-5 place-items-center">
          <Plus className="h-3.5 w-3.5" />
        </span>
        New project
      </button>

      {done.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="mt-2 flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronRight
              className={cn("h-3.5 w-3.5 transition-transform", showDone && "rotate-90")}
            />
            Finished
            <span className="ml-1 tabular-nums">{done.length}</span>
          </button>
          {showDone &&
            done.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                isActive={selected === project.id}
                sortable={false}
                onSelect={onSelect}
              />
            ))}
        </>
      )}
    </div>
  );
}
