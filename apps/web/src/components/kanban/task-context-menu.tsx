import * as React from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { useNavigate } from "@tanstack/react-router";
import {
  Focus,
  Calendar,
  ArrowUp,
  ArrowDown,
  CalendarArrowUp,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Archive,
  Repeat,
  Flag,
  FolderOpen,
  Hash,
  X,
  ListEnd,
} from "lucide-react";
import { openTaskForNextStep } from "@/lib/open-task";
import type { Task, CreateTaskSeriesInput, TaskPriority } from "@open-sunsama/types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuCheckboxItem,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  PriorityIcon,
  PRIORITY_LABELS,
} from "@/components/ui";
import {
  useUpdateTask,
  useDeleteTask,
  useCreateTask,
  useReorderTasks,
  useTasks,
} from "@/hooks/useTasks";
import { useAutoSchedule } from "@/hooks";
import { useSubtasks } from "@/hooks/useSubtasks";
import { useCreateTaskSeries } from "@/hooks/useTaskSeries";
import { formatShortcut, SHORTCUTS } from "@/hooks/useKeyboardShortcuts";
import { toast } from "@/hooks/use-toast";
import { RepeatConfigDialog } from "./repeat-config-popover";
import { useProjects } from "@/hooks/useProjects";
import { ProjectDot } from "@/components/projects/project-picker";
import { useTags } from "@/hooks/useTags";
import { cn } from "@/lib/utils";

const PRIORITIES: TaskPriority[] = ["P0", "P1", "P2", "P3"];

interface TaskContextMenuProps {
  task: Task;
  children: React.ReactNode;
  onEdit?: () => void;
  onFocus?: () => void;
}

export function TaskContextMenu({
  task,
  children,
  onEdit: _onEdit,
  onFocus: _onFocus,
}: TaskContextMenuProps) {
  const navigate = useNavigate();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createTask = useCreateTask();
  const reorderTasks = useReorderTasks();
  const autoSchedule = useAutoSchedule();
  const createTaskSeries = useCreateTaskSeries();

  // State for repeat config dialog
  const [repeatDialogOpen, setRepeatDialogOpen] = React.useState(false);

  // Fetch tasks for the same date/backlog to support reordering
  const { data: tasksInSameList } = useTasks(
    task.scheduledDate
      ? { scheduledDate: task.scheduledDate }
      : { backlog: true }
  );

  // Fetch subtasks to check if the task has any
  const { data: subtasks } = useSubtasks(task.id);
  const hasSubtasks = subtasks && subtasks.length > 0;

  const handleFocus = () => {
    // Navigate to focus mode for this task
    navigate({ to: "/app/focus/$taskId", params: { taskId: task.id } });
  };

  const handleAddToCalendar = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const isToday = task.scheduledDate === today || !task.scheduledDate;
    let currentTime: string | undefined;
    if (isToday) {
      const now = new Date();
      currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }
    await autoSchedule.mutateAsync({ taskId: task.id, currentTime });
  };

  const handleMoveToTop = async () => {
    if (!tasksInSameList || tasksInSameList.length === 0) return;

    // Get all incomplete tasks sorted by position
    const incompleteTasks = tasksInSameList
      .filter((t) => !t.completedAt)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    // Move current task to top
    const newOrder = [
      task.id,
      ...incompleteTasks.filter((t) => t.id !== task.id).map((t) => t.id),
    ];

    const dateKey = task.scheduledDate || "backlog";
    await reorderTasks.mutateAsync({ date: dateKey, taskIds: newOrder });

    toast({
      title: "Task moved to top",
      description: `"${task.title}" moved to top of the list.`,
    });
  };

  const handleMoveToBottom = async () => {
    if (!tasksInSameList || tasksInSameList.length === 0) return;

    // Get all incomplete tasks sorted by position
    const incompleteTasks = tasksInSameList
      .filter((t) => !t.completedAt)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    // Move current task to bottom
    const newOrder = [
      ...incompleteTasks.filter((t) => t.id !== task.id).map((t) => t.id),
      task.id,
    ];

    const dateKey = task.scheduledDate || "backlog";
    await reorderTasks.mutateAsync({ date: dateKey, taskIds: newOrder });

    toast({
      title: "Task moved to bottom",
      description: `"${task.title}" moved to bottom of the list.`,
    });
  };

  const handleDeferToNextWeek = async () => {
    // Calculate next Monday relative to the task's current scheduled date
    const referenceDate = task.scheduledDate
      ? new Date(task.scheduledDate + "T00:00:00")
      : new Date();
    const nextMonday = addDays(startOfWeek(referenceDate, { weekStartsOn: 1 }), 7);
    const nextMondayStr = format(nextMonday, "yyyy-MM-dd");

    await updateTask.mutateAsync({
      id: task.id,
      data: { scheduledDate: nextMondayStr },
    });

    toast({
      title: "Task deferred",
      description: `"${task.title}" moved to ${format(nextMonday, "EEEE, MMM d")}.`,
    });
  };

  const handleDeferToBacklog = async () => {
    if (task.scheduledDate === null) return;

    await updateTask.mutateAsync({
      id: task.id,
      data: { scheduledDate: null },
    });

    toast({
      title: "Task deferred",
      description: `"${task.title}" moved to backlog.`,
    });
  };

  const { data: projects = [] } = useProjects();
  const { data: allTags = [] } = useTags();

  const handleToggleTag = async (tagId: string) => {
    const current = task.tagIds ?? [];
    const tagIds = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    await updateTask.mutateAsync({ id: task.id, data: { tagIds } });
  };

  const handlePriorityChange = async (priority: TaskPriority) => {
    await updateTask.mutateAsync({
      id: task.id,
      data: { priority },
    });

    toast({
      title: "Priority updated",
      description: `"${task.title}" priority set to ${PRIORITY_LABELS[priority]}.`,
    });
  };

  const handleProjectChange = async (projectId: string | null) => {
    if (projectId === (task.projectId ?? null)) return;
    await updateTask.mutateAsync({ id: task.id, data: { projectId } });
    const name = projects.find((p) => p.id === projectId)?.name;
    toast({
      title: name ? `Moved to ${name}` : "Removed from project",
    });
  };

  const handleToggleHideSubtasks = async () => {
    const newHiddenState = !task.subtasksHidden;
    await updateTask.mutateAsync({
      id: task.id,
      data: { subtasksHidden: newHiddenState },
    });
    toast({
      title: newHiddenState ? "Subtasks hidden" : "Subtasks shown",
    });
  };

  const handleDuplicate = async () => {
    await createTask.mutateAsync({
      title: task.title,
      notes: task.notes ?? undefined,
      priority: task.priority,
      scheduledDate: task.scheduledDate ?? undefined,
      estimatedMins: task.estimatedMins,
      projectId: task.projectId ?? undefined,
      tagIds: task.tagIds,
    });

    toast({
      title: "Task duplicated",
      description: `A copy of "${task.title}" has been created.`,
    });
  };

  const handleRepeatSave = async (config: CreateTaskSeriesInput) => {
    // Create a series with task details
    await createTaskSeries.mutateAsync({
      ...config,
      title: task.title,
      notes: task.notes ?? undefined,
      priority: task.priority,
      estimatedMins: task.estimatedMins ?? undefined,
    });
  };

  const handleDelete = async () => {
    const deletedTask = task;

    await deleteTask.mutateAsync(task.id);

    toast({
      title: "Task removed",
      description: `"${deletedTask.title}" has been removed.`,
      action: (
        <button
          className="text-primary hover:underline text-sm font-medium"
          onClick={async () => {
            toast({
              title: "Cannot undo",
              description: "Task deletion cannot be undone.",
            });
          }}
        >
          Undo
        </button>
      ),
    });
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {/* Focus */}
          <ContextMenuItem onClick={handleFocus}>
            <Focus className="mr-2 h-4 w-4" />
            Focus
            <ContextMenuShortcut>
              {SHORTCUTS.focus && formatShortcut(SHORTCUTS.focus)}
            </ContextMenuShortcut>
          </ContextMenuItem>

          {/* Add to calendar */}
          <ContextMenuItem onClick={handleAddToCalendar}>
            <Calendar className="mr-2 h-4 w-4" />
            Add to calendar
            <ContextMenuShortcut>
              {SHORTCUTS.addToCalendar &&
                formatShortcut(SHORTCUTS.addToCalendar)}
            </ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

          {/* Move to top */}
          <ContextMenuItem onClick={handleMoveToTop}>
            <ArrowUp className="mr-2 h-4 w-4" />
            Move to top
            <ContextMenuShortcut>
              {SHORTCUTS.moveToTop && formatShortcut(SHORTCUTS.moveToTop)}
            </ContextMenuShortcut>
          </ContextMenuItem>

          {/* Move to bottom */}
          <ContextMenuItem onClick={handleMoveToBottom}>
            <ArrowDown className="mr-2 h-4 w-4" />
            Move to bottom
            <ContextMenuShortcut>
              {SHORTCUTS.moveToBottom && formatShortcut(SHORTCUTS.moveToBottom)}
            </ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

          {/* Defer to next week */}
          <ContextMenuItem onClick={handleDeferToNextWeek}>
            <CalendarArrowUp className="mr-2 h-4 w-4" />
            Defer to next week
            <ContextMenuShortcut>
              {SHORTCUTS.deferToNextWeek &&
                formatShortcut(SHORTCUTS.deferToNextWeek)}
            </ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem onClick={handleDeferToBacklog}>
            <Archive className="mr-2 h-4 w-4" />
            Defer to backlog
            <ContextMenuShortcut>
              {SHORTCUTS.moveToBacklog &&
                formatShortcut(SHORTCUTS.moveToBacklog)}
            </ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

          {/* Priority */}
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Flag className="mr-2 h-4 w-4" />
              Priority
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {PRIORITIES.map((priority) => (
                <ContextMenuItem
                  key={priority}
                  onClick={() => handlePriorityChange(priority)}
                  className={cn(
                    "gap-2",
                    task.priority === priority && "bg-accent"
                  )}
                >
                  <PriorityIcon priority={priority} />
                  <span>{PRIORITY_LABELS[priority]}</span>
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>

          {/* Tags */}
          {allTags.length > 0 && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Hash className="mr-2 h-4 w-4" />
                Tags
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="max-h-80 overflow-y-auto">
                {allTags.map((tag) => (
                  <ContextMenuCheckboxItem
                    key={tag.id}
                    checked={(task.tagIds ?? []).includes(tag.id)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() => void handleToggleTag(tag.id)}
                    className="gap-2"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="max-w-[14rem] truncate">{tag.name}</span>
                  </ContextMenuCheckboxItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}

          {/* Project */}
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <FolderOpen className="mr-2 h-4 w-4" />
              Project
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="max-h-80 overflow-y-auto">
              <ContextMenuItem
                onClick={() => handleProjectChange(null)}
                className={cn("gap-2", !task.projectId && "bg-accent")}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
                <span>No project</span>
              </ContextMenuItem>
              {projects
                .filter(
                  (p) =>
                    p.id === task.projectId ||
                    p.status === "active" ||
                    p.status === "on_hold"
                )
                .map((project) => (
                  <ContextMenuItem
                    key={project.id}
                    onClick={() => handleProjectChange(project.id)}
                    className={cn(
                      "gap-2",
                      task.projectId === project.id && "bg-accent"
                    )}
                  >
                    <ProjectDot color={project.color} />
                    <span className="max-w-[14rem] truncate">{project.name}</span>
                  </ContextMenuItem>
                ))}
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          {/* Hide subtasks - only show if task has subtasks */}
          {hasSubtasks && (
            <ContextMenuItem onClick={handleToggleHideSubtasks}>
              {task.subtasksHidden ? (
                <Eye className="mr-2 h-4 w-4" />
              ) : (
                <EyeOff className="mr-2 h-4 w-4" />
              )}
              {task.subtasksHidden ? "Show subtasks" : "Hide subtasks"}
              <ContextMenuShortcut>
                {SHORTCUTS.hideSubtasks &&
                  formatShortcut(SHORTCUTS.hideSubtasks)}
              </ContextMenuShortcut>
            </ContextMenuItem>
          )}

          {/* A new task that waits on this one */}
          <ContextMenuItem onClick={() => openTaskForNextStep(task.id)}>
            <ListEnd className="mr-2 h-4 w-4" />
            Add next step…
          </ContextMenuItem>

          {/* Duplicate */}
          <ContextMenuItem onClick={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
            <ContextMenuShortcut>
              {SHORTCUTS.duplicate && formatShortcut(SHORTCUTS.duplicate)}
            </ContextMenuShortcut>
          </ContextMenuItem>

          {/* Repeat - only show if task is not already part of a series */}
          {!task.seriesId && (
            <ContextMenuItem onSelect={() => setRepeatDialogOpen(true)}>
              <Repeat className="mr-2 h-4 w-4" />
              Repeat...
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          {/* Remove from tasks */}
          <ContextMenuItem
            onClick={handleDelete}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove from tasks
            <ContextMenuShortcut>
              {SHORTCUTS.deleteTask && formatShortcut(SHORTCUTS.deleteTask)}
            </ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Repeat Config Dialog - rendered outside context menu */}
      {!task.seriesId && (
        <RepeatConfigDialog
          title={task.title}
          initialConfig={{
            notes: task.notes ?? undefined,
            priority: task.priority,
            estimatedMins: task.estimatedMins ?? undefined,
          }}
          onSave={handleRepeatSave}
          open={repeatDialogOpen}
          onOpenChange={setRepeatDialogOpen}
        />
      )}
    </>
  );
}
