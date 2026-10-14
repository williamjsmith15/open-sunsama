import { defaultTaskMins } from "@open-sunsama/utils";
import { useAuth } from "@/hooks/useAuth";

/**
 * Planned minutes a new task starts with (Settings → Tasks). Null when the
 * user turned the default off. The API applies the same default to tasks
 * created without a planned time.
 */
export function useDefaultTaskMins(): number | null {
  const { user } = useAuth();
  return defaultTaskMins(user?.preferences);
}
