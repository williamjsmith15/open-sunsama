/**
 * App constants for Open Sunsama
 */

/** Prefix for all API keys (new keys use this) */
export const API_KEY_PREFIX = 'os_' as const;

/** Legacy prefix for backward compatibility with existing keys */
export const LEGACY_API_KEY_PREFIX = 'cf_' as const;

/** Default timezone for date operations */
export const DEFAULT_TIMEZONE = 'UTC' as const;

/** Available options for estimated minutes on tasks */
export const ESTIMATED_MINS_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

/** Planned time for a new task when the user hasn't chosen one in settings. */
export const DEFAULT_TASK_MINS = 60;

/**
 * Planned time for a new task with none given: the user's setting, 60 minutes
 * when it was never set, or null when they turned it off.
 */
export function defaultTaskMins(
  preferences: { defaultTaskMins?: number | null } | null | undefined
): number | null {
  const value = preferences?.defaultTaskMins;
  return value === undefined ? DEFAULT_TASK_MINS : value;
}

/** Standard date format (ISO 8601 date only) */
export const DATE_FORMAT = 'yyyy-MM-dd' as const;

/** Standard time format (24-hour) */
export const TIME_FORMAT = 'HH:mm' as const;

/** Minimum password length */
export const MIN_PASSWORD_LENGTH = 8;

/** Maximum password length */
export const MAX_PASSWORD_LENGTH = 128;

/** API key length (excluding prefix) */
export const API_KEY_LENGTH = 32;

/** Task priorities */
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Task statuses */
export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Time block statuses */
export const TIME_BLOCK_STATUSES = ['scheduled', 'in_progress', 'completed', 'skipped'] as const;
export type TimeBlockStatus = (typeof TIME_BLOCK_STATUSES)[number];
