import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateTagInput, Tag, UpdateTagInput } from "@open-sunsama/types";
import { getApiClient } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { tagKeys, taskKeys } from "@/lib/query-keys";

export { tagKeys };

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

function failed(title: string) {
  return (error: unknown) =>
    toast({
      variant: "destructive",
      title,
      description: error instanceof Error ? error.message : "Unknown error",
    });
}

/** The user's tags by name, with open task counts. */
export function useTags() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: tagKeys.lists(),
    queryFn: async (): Promise<Tag[]> => {
      const res = await getApiClient().get<ApiResponse<Tag[]>>("tags");
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

/** Look up tags by id; for pills and pickers. */
export function useTagMap() {
  const { data } = useTags();
  return React.useMemo(() => new Map((data ?? []).map((t) => [t.id, t])), [data]);
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTagInput): Promise<Tag> => {
      const res = await getApiClient().post<ApiResponse<Tag>>("tags", input);
      return res.data;
    },
    onSuccess: (tag) => {
      queryClient.setQueryData<Tag[]>(tagKeys.lists(), (old) =>
        [...(old ?? []).filter((t) => t.id !== tag.id), tag].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        )
      );
    },
    onError: failed("Failed to create tag"),
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTagInput }): Promise<Tag> => {
      const res = await getApiClient().patch<ApiResponse<Tag>>(`tags/${id}`, input);
      return res.data;
    },
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: tagKeys.lists() });
      const previous = queryClient.getQueryData<Tag[]>(tagKeys.lists());
      queryClient.setQueryData<Tag[]>(tagKeys.lists(), (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...input } : t))
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(tagKeys.lists(), context.previous);
      failed("Failed to update tag")(error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await getApiClient().delete(`tags/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Tag[]>(tagKeys.lists(), (old) => old?.filter((t) => t.id !== id));
      // Tasks lose the tag
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
    onError: failed("Failed to delete tag"),
  });
}
