/**
 * Open any task in the app shell's task editor, from anywhere (e.g. a
 * dependency link inside another task's editor). The shell listens for
 * this event and loads the task.
 */
export const OPEN_TASK_EVENT = "open-sunsama:open-task";

export function openTask(taskId: string) {
  window.dispatchEvent(new CustomEvent<string>(OPEN_TASK_EVENT, { detail: taskId }));
}
