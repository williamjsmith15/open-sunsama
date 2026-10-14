import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  TimeBlock,
  CreateTimeBlockInput,
  UpdateTimeBlockInput,
  QuickScheduleInput,
  AutoScheduleInput,
} from "@open-sunsama/types";
import { getApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { subtaskKeys, taskKeys, timeBlockKeys } from "@/lib/query-keys";
import { trackGoal } from "@/lib/analytics";

/**
 * Create a new time block
 */
export function useCreateTimeBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTimeBlockInput): Promise<TimeBlock> => {
      const api = getApi();
      return await api.timeBlocks.create(data);
    },
    onSuccess: (newTimeBlock) => {
      trackGoal("create_time_block");
      // Invalidate and refetch time block lists
      queryClient.invalidateQueries({ queryKey: timeBlockKeys.lists() });
      // A second block for a task (or subtask) re-plans it on the server.
      if (newTimeBlock.taskId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.all });
        queryClient.invalidateQueries({ queryKey: subtaskKeys.all });
      }

      // Add the new time block to the cache
      queryClient.setQueryData(
        timeBlockKeys.detail(newTimeBlock.id),
        newTimeBlock
      );

      toast({
        title: "Time block created",
        description: `"${newTimeBlock.title}" has been scheduled.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to create time block",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });
}

/**
 * Update an existing time block
 */
export function useUpdateTimeBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateTimeBlockInput;
    }): Promise<TimeBlock> => {
      const api = getApi();
      return await api.timeBlocks.update(id, data);
    },
    onSuccess: (updatedTimeBlock) => {
      // Update the time block in cache
      queryClient.setQueryData(
        timeBlockKeys.detail(updatedTimeBlock.id),
        updatedTimeBlock
      );

      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: timeBlockKeys.lists() });
      // A linked block's new length re-plans its task on the server.
      if (updatedTimeBlock.taskId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.all });
      }
      if (updatedTimeBlock.subtaskId) {
        queryClient.invalidateQueries({ queryKey: subtaskKeys.all });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to update time block",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });
}

/**
 * Delete a time block
 */
export function useDeleteTimeBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const api = getApi();
      await api.timeBlocks.delete(id);
      return id;
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: timeBlockKeys.detail(deletedId) });

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: timeBlockKeys.lists() });
      // Removing one of several blocks re-plans its task on the server.
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: subtaskKeys.all });

      toast({
        title: "Time block deleted",
        description: "The time block has been deleted.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete time block",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });
}

/**
 * Quick schedule - create a time block from a task
 */
export function useQuickSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: QuickScheduleInput): Promise<TimeBlock> => {
      const api = getApi();
      return await api.timeBlocks.quickSchedule(data);
    },
    onSuccess: (newTimeBlock) => {
      trackGoal("create_time_block");
      queryClient.invalidateQueries({ queryKey: timeBlockKeys.lists() });
      queryClient.setQueryData(
        timeBlockKeys.detail(newTimeBlock.id),
        newTimeBlock
      );

      toast({
        title: "Task scheduled",
        description: `"${newTimeBlock.title}" has been added to your calendar.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to schedule task",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });
}

/**
 * Auto schedule - create a time block from a task at the next available slot
 * The API automatically finds the best time within working hours (9 AM - 6 PM)
 */
export function useAutoSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AutoScheduleInput): Promise<TimeBlock> => {
      const api = getApi();
      return await api.timeBlocks.autoSchedule(data);
    },
    onSuccess: (newTimeBlock) => {
      trackGoal("create_time_block");
      queryClient.invalidateQueries({ queryKey: timeBlockKeys.lists() });
      queryClient.setQueryData(
        timeBlockKeys.detail(newTimeBlock.id),
        newTimeBlock
      );

      toast({
        title: "Task scheduled",
        description: `"${newTimeBlock.title}" has been added to your calendar.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to schedule task",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });
}

// Timer-related mutations are owned by ./useTimeBlockTimer and are
// re-exported from ./useTimeBlocks (the public barrel for this domain).
// We deliberately do NOT re-export them from here — useTimeBlockTimer
// imports useUpdateTimeBlock from this file, and re-exporting through
// here would create a chunk-level cycle.
