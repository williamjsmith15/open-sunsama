import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@open-sunsama/types";
import { getApiClient } from "@/lib/api";
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
    onError: async (error) => {
      // Surface the API's reason (e.g. "That would make a loop…").
      let description = error instanceof Error ? error.message : "Unknown error";
      const response = (error as { response?: Response }).response;
      if (response) {
        try {
          const body = (await response.clone().json()) as { error?: { message?: string } };
          if (body.error?.message) description = body.error.message;
        } catch {
          // keep the generic message
        }
      }
      toast({ variant: "destructive", title: "Couldn't add dependency", description });
    },
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
