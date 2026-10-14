/**
 * Tag type definitions for Open Sunsama.
 * Labels on tasks that cut across projects.
 * @module @open-sunsama/types/tag
 */

export interface Tag {
  id: string;
  userId: string;
  /** Unique per user, ignoring case */
  name: string;
  /** Hex color, e.g. "#6B7280" */
  color: string;
  /** Incomplete tasks carrying the tag (list endpoint) */
  openTaskCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTagInput {
  name: string;
  color?: string;
}

export type UpdateTagInput = Partial<CreateTagInput>;
