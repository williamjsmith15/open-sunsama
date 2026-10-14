import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateProjectInput,
  Project,
  UpdateProjectInput,
} from "@open-sunsama/types";
import { getApiClient } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { projectKeys, taskKeys } from "@/lib/query-keys";

export { projectKeys };

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

/** The user's projects in rail order, with open/completed task counts. */
export function useProjects() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: projectKeys.lists(),
    queryFn: async (): Promise<Project[]> => {
      const res = await getApiClient().get<ApiResponse<Project[]>>("projects");
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

/** Look up projects by id; for chips and pickers. */
export function useProjectMap() {
  const { data } = useProjects();
  return new Map((data ?? []).map((p) => [p.id, p]));
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectInput): Promise<Project> => {
      const res = await getApiClient().post<ApiResponse<Project>>("projects", input);
      return res.data;
    },
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(projectKeys.lists(), (old) =>
        old ? [...old.filter((p) => p.id !== project.id), project] : [project]
      );
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
    onError: failed("Failed to create project"),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateProjectInput;
    }): Promise<Project> => {
      const res = await getApiClient().patch<ApiResponse<Project>>(
        `projects/${id}`,
        input
      );
      return res.data;
    },
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.lists() });
      const previous = queryClient.getQueryData<Project[]>(projectKeys.lists());
      queryClient.setQueryData<Project[]>(projectKeys.lists(), (old) =>
        old?.map((p) => (p.id === id ? ({ ...p, ...input } as Project) : p))
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(projectKeys.lists(), context.previous);
      }
      failed("Failed to update project")(error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await getApiClient().delete(`projects/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Project[]>(projectKeys.lists(), (old) =>
        old?.filter((p) => p.id !== id)
      );
      // Its tasks are now unassigned.
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast({ title: "Project deleted", description: "Its tasks were kept." });
    },
    onError: failed("Failed to delete project"),
  });
}

export function useReorderProjects() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectIds: string[]): Promise<Project[]> => {
      const res = await getApiClient().post<ApiResponse<Project[]>>(
        "projects/reorder",
        { projectIds }
      );
      return res.data;
    },
    onMutate: async (projectIds) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.lists() });
      const previous = queryClient.getQueryData<Project[]>(projectKeys.lists());
      if (previous) {
        const byId = new Map(previous.map((p) => [p.id, p]));
        queryClient.setQueryData<Project[]>(
          projectKeys.lists(),
          projectIds
            .map((id, position) => {
              const p = byId.get(id);
              return p ? { ...p, position } : undefined;
            })
            .filter((p): p is Project => !!p)
        );
      }
      return { previous };
    },
    onError: (error, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(projectKeys.lists(), context.previous);
      }
      failed("Failed to reorder projects")(error);
    },
    onSuccess: (projects) => {
      queryClient.setQueryData(projectKeys.lists(), projects);
    },
  });
}
