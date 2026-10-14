/**
 * Project type definitions for Open Sunsama.
 * Flat projects that group tasks; a task belongs to at most one.
 * @module @open-sunsama/types/project
 */

export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";

export interface Project {
  /** Unique identifier (UUID) */
  id: string;
  /** Owning user */
  userId: string;
  name: string;
  description: string | null;
  /** Hex color from the shared palette, e.g. "#6366F1" */
  color: string;
  /** lucide-react icon name, e.g. "Folder" */
  icon: string;
  status: ProjectStatus;
  /** Date the project should be finished by (YYYY-MM-DD); null when unset */
  targetDate: string | null;
  /** Order in the project rail (lower first) */
  position: number;
  /** Incomplete tasks in the project (list and get endpoints) */
  openTaskCount?: number;
  /** Completed tasks in the project (list and get endpoints) */
  completedTaskCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  color?: string;
  icon?: string;
  status?: ProjectStatus;
  targetDate?: string | null;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;
