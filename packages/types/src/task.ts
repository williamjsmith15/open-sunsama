/**
 * Task-related type definitions for Open Sunsama
 * @module @open-sunsama/types/task
 */

import type { TaskExternalLink } from "./integration.js";

/**
 * Task priority levels.
 * P0 = Critical/Urgent, P1 = High, P2 = Medium (default), P3 = Low
 */
export type TaskPriority = "P0" | "P1" | "P2" | "P3";

/** A related task, as listed in `blockedBy` / `blocking`. */
export interface TaskDependencyRef {
  id: string;
  title: string;
  completedAt: Date | string | null;
  scheduledDate: string | null;
  dueDate: string | null;
  projectId: string | null;
}

/**
 * Represents a task in the Open Sunsama system.
 * Tasks are the core productivity unit that users create, schedule, and complete.
 */
export interface Task {
  /** Unique identifier for the task (UUID format) */
  id: string;

  /** ID of the user who owns this task */
  userId: string;

  /** Title/description of the task */
  title: string;

  /** Additional notes or details about the task (optional) */
  notes: string | null;

  /**
   * Date when the task is scheduled to be completed.
   * Format: YYYY-MM-DD (ISO 8601 date format)
   * null indicates an unscheduled/backlog task
   */
  scheduledDate: string | null;

  /** Deadline (YYYY-MM-DD), separate from the day it's planned; null when none */
  dueDate: string | null;

  /**
   * Estimated time to complete the task in minutes.
   * null indicates no estimate has been provided
   */
  estimatedMins: number | null;

  /**
   * True once the planned time was set by hand; until then it follows the
   * total of the subtasks' planned times.
   */
  estimatedMinsManual?: boolean;

  /**
   * Actual time spent on the task in minutes.
   * Tracked via focus mode timer.
   */
  actualMins: number | null;

  /**
   * Priority level of the task.
   * P0 = Critical/Urgent, P1 = High, P2 = Medium (default), P3 = Low
   */
  priority: TaskPriority;

  /**
   * Timestamp when the task was marked as completed.
   * null indicates the task is not yet completed
   */
  completedAt: Date | null;

  /**
   * Position of the task in the list for ordering purposes.
   * Lower numbers appear first. Used for drag-and-drop reordering.
   */
  position: number;

  /**
   * Whether subtasks should be hidden in the task card view.
   * Default is false (subtasks are shown).
   */
  subtasksHidden: boolean;

  /** Project this task belongs to; null when unassigned */
  projectId: string | null;

  /** IDs of the task's tags. Present on task endpoints; absent from older APIs. */
  tagIds?: string[];

  /** Tasks that must be done before this one. Present on task endpoints. */
  blockedBy?: TaskDependencyRef[];

  /** Tasks waiting on this one. Present on task endpoints. */
  blocking?: TaskDependencyRef[];

  /**
   * ID of the task series this instance belongs to.
   * Null for regular (non-recurring) tasks.
   */
  seriesId: string | null;

  /**
   * Instance number within the series (1, 2, 3, ...).
   * Used for "This is the Nth instance" display.
   * Null for regular tasks.
   */
  seriesInstanceNumber: number | null;

  /**
   * Timestamp when the focus timer was started.
   * null indicates the timer is not currently running.
   */
  timerStartedAt: Date | null;

  /**
   * Accumulated seconds from previous start/stop cycles in the current session.
   * Resets to 0 when the timer is stopped and actualMins is saved.
   */
  timerAccumulatedSeconds: number;

  /**
    * External objects this task is linked to — the external task it was
   * imported from, a pull request attached by hand, and so on. Only
   * present on endpoints that ask for links.
   */
  externalLinks?: TaskExternalLink[];

  /** Timestamp when the task was created */
  createdAt: Date;

  /** Timestamp when the task was last updated */
  updatedAt: Date;
}

/**
 * Input data required to create a new task.
 * Title is the only required field; all others have sensible defaults.
 */
export interface CreateTaskInput {
  /** Title/description of the task */
  title: string;

  /** Additional notes or details about the task */
  notes?: string;

  /**
   * Date when the task should be scheduled.
   * Format: YYYY-MM-DD
   * Omit for backlog/unscheduled tasks
   */
  scheduledDate?: string;

  /** Estimated time to complete the task in minutes */
  estimatedMins?: number | null;

  /** Priority level (P0=Critical, P1=High, P2=Medium, P3=Low) */
  priority?: TaskPriority;

  /** Project to put the task in */
  projectId?: string | null;

  /** Tags to put on the task */
  tagIds?: string[];

  /** Deadline (YYYY-MM-DD) */
  dueDate?: string | null;
}

/**
 * Input data for updating an existing task.
 * All fields are optional; only provided fields will be updated.
 * Use null to clear optional fields.
 */
export interface UpdateTaskInput {
  /** Updated title/description */
  title?: string;

  /** Updated notes (use null to clear) */
  notes?: string | null;

  /**
   * Updated scheduled date (use null to move to backlog).
   * Format: YYYY-MM-DD
   */
  scheduledDate?: string | null;

  /** Updated time estimate in minutes (use null to clear) */
  estimatedMins?: number | null;

  /** Updated priority level */
  priority?: TaskPriority;

  /** Updated actual time spent in minutes */
  actualMins?: number | null;

  /**
   * Set completion timestamp (use null to mark as incomplete).
   * Typically set to current Date when completing a task.
   */
  completedAt?: Date | null;

  /** Updated position for ordering */
  position?: number;

  /** Whether to hide subtasks in the task card view */
  subtasksHidden?: boolean;

  /** Move to a project (null removes it from its project) */
  projectId?: string | null;

  /** Replace the task's tags */
  tagIds?: string[];

  /** Deadline (YYYY-MM-DD); null clears it */
  dueDate?: string | null;
}

/**
 * Input data for reordering tasks within a specific date.
 * Used to update positions after drag-and-drop operations.
 */
export interface ReorderTasksInput {
  /**
   * The date for which tasks are being reordered.
   * Format: YYYY-MM-DD
   * Use "backlog" for unscheduled tasks
   */
  date: string;

  /**
   * Array of task IDs in their new order.
   * Position values will be assigned based on array index.
   */
  taskIds: string[];
}

/**
 * Input for moving a task to a different date.
 * Combines date change with optional position update.
 */
export interface MoveTaskInput {
  /**
   * Target date to move the task to.
   * Format: YYYY-MM-DD
   * Use null to move to backlog
   */
  targetDate: string | null;

  /**
   * Position in the target date's task list.
   * If omitted, task will be added at the end.
   */
  position?: number;
}

/**
 * Sort options for task queries.
 */
export type TaskSortBy = "priority" | "position" | "createdAt";

/**
 * Filter options for querying tasks.
 * All fields are optional and combined with AND logic.
 */
export interface TaskFilterInput {
  /** Filter by scheduled date (exact match) */
  scheduledDate?: string | null;

  /** Filter tasks scheduled on or after this date */
  scheduledDateFrom?: string;

  /** Filter tasks scheduled on or before this date */
  scheduledDateTo?: string;

  /** Filter by completion status */
  completed?: boolean;

  /** Filter for backlog (unscheduled) tasks */
  backlog?: boolean;

  /** Search by title (case-insensitive partial match) */
  titleSearch?: string;

  /** Sort by field (default: position) */
  sortBy?: TaskSortBy;

  /** Page number for pagination (1-based) */
  page?: number;

  /** Number of items per page */
  limit?: number;

  /** Filter by priority level */
  priority?: TaskPriority;

  /** A project's tasks, or "none" for tasks without a project */
  projectId?: string;

  /** Tasks carrying this tag */
  tagId?: string;

  /** Tasks due on or before this date (YYYY-MM-DD) */
  dueBefore?: string;

  /**
   * If true, the server inlines each task's subtasks into the response as
   * a `subtasks: Subtask[]` field on each task. Used by the kanban range
   * prefetch to avoid a follow-up `subtasks-batch` request.
   */
  includeSubtasks?: boolean;
}

/**
 * Summary statistics for tasks.
 * Useful for dashboard displays and productivity tracking.
 */
export interface TaskStats {
  /** Total number of tasks */
  total: number;

  /** Number of completed tasks */
  completed: number;

  /** Number of pending (incomplete) tasks */
  pending: number;

  /** Total estimated minutes for all tasks */
  totalEstimatedMins: number;

  /** Total estimated minutes for completed tasks */
  completedEstimatedMins: number;
}

/**
 * Task with computed/derived properties.
 * Extended task information for UI display.
 */
export interface TaskWithMeta extends Task {
  /** Whether the task is overdue (scheduled date has passed and not completed) */
  isOverdue: boolean;

  /** Whether the task is scheduled for today */
  isToday: boolean;
}
