/**
 * Open any task in the app shell's task editor, from anywhere (e.g. a
 * dependency link inside another task's editor). The shell listens for
 * this event and loads the task.
 */
export const OPEN_TASK_EVENT = "open-sunsama:open-task";

export function openTask(taskId: string) {
  window.dispatchEvent(new CustomEvent<string>(OPEN_TASK_EVENT, { detail: taskId }));
}

// Set by "Add next step…" so the editor opens with that field focused.
let nextStepFor: string | null = null;

/** Open a task's editor ready to type the step that comes after it. */
export function openTaskForNextStep(taskId: string) {
  nextStepFor = taskId;
  openTask(taskId);
}

/** True once for the task "Add next step…" was chosen on. */
export function takeNextStepFocus(taskId: string): boolean {
  if (nextStepFor !== taskId) return false;
  nextStepFor = null;
  return true;
}
