import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@open-sunsama/types";
import { getApi, getApiClient } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { taskKeys } from "@/lib/query-keys";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/** Both tasks' blockedBy/blocking change, so refresh every task view. */
function refresh(queryClient: ReturnType<typeof useQueryClient>, task: Task) {
  queryClient.setQueryData(taskKeys.detail(task.id), task);
  queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
  queryClient.invalidateQueries({ queryKey: taskKeys.rangeAll() });
  queryClient.invalidateQueries({ queryKey: taskKeys.details() });
}

/** The API's reason for a refusal (e.g. "That would make a loop…"). */
async function apiErrorMessage(error: unknown): Promise<string> {
  let message = error instanceof Error ? error.message : "Unknown error";
  const response = (error as { response?: Response }).response;
  if (response) {
    try {
      const body = (await response.clone().json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      // keep the generic message
    }
  }
  return message;
}

function refreshAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: taskKeys.all });
}

/** Link tasks in order: each waits on the one before it. */
export function useLinkChain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      const res = await getApiClient().post<ApiResponse<{ added: number }>>(
        "tasks/dependencies/chain",
        { taskIds }
      );
      return res.data;
    },
    onSuccess: (_, taskIds) => {
      refreshAll(queryClient);
      toast({ title: `Linked ${taskIds.length} tasks in order` });
    },
    onError: async (error) =>
      toast({
        variant: "destructive",
        title: "Couldn't link those tasks",
        description: await apiErrorMessage(error),
      }),
  });
}

/** Remove every link between the given tasks. */
export function useUnlinkTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      const res = await getApiClient().post<ApiResponse<{ removed: number }>>(
        "tasks/dependencies/unlink",
        { taskIds }
      );
      return res.data;
    },
    onSuccess: ({ removed }) => {
      refreshAll(queryClient);
      toast({ title: removed ? `Removed ${removed} link${removed === 1 ? "" : "s"}` : "No links between those tasks" });
    },
    onError: async (error) =>
      toast({
        variant: "destructive",
        title: "Couldn't unlink those tasks",
        description: await apiErrorMessage(error),
      }),
  });
}

/** Create a task that waits on `after`, in the same project. */
export function useAddNextStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ after, title }: { after: Task; title: string }) => {
      const next = await getApi().tasks.create({
        title,
        projectId: after.projectId ?? undefined,
      });
      await getApiClient().post("tasks/dependencies/chain", { taskIds: [after.id, next.id] });
      return next;
    },
    onSuccess: () => refreshAll(queryClient),
    onError: async (error) =>
      toast({
        variant: "destructive",
        title: "Couldn't add the next step",
        description: await apiErrorMessage(error),
      }),
  });
}

/** `blockerTaskId` must be done before `taskId`. */
export function useAddDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, blockerTaskId }: { taskId: string; blockerTaskId: string }) => {
      const res = await getApiClient().post<ApiResponse<Task>>(
        `tasks/${taskId}/dependencies`,
        { blockerTaskId }
      );
      return res.data;
    },
    onSuccess: (task) => refresh(queryClient, task),
    onError: async (error) =>
      toast({
        variant: "destructive",
        title: "Couldn't add dependency",
        description: await apiErrorMessage(error),
      }),
  });
}

export function useRemoveDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, blockerTaskId }: { taskId: string; blockerTaskId: string }) => {
      const res = await getApiClient().delete<ApiResponse<Task>>(
        `tasks/${taskId}/dependencies/${blockerTaskId}`
      );
      return res.data;
    },
    onSuccess: (task) => refresh(queryClient, task),
    onError: (error) =>
      toast({
        variant: "destructive",
        title: "Couldn't remove dependency",
        description: error instanceof Error ? error.message : "Unknown error",
      }),
  });
}
