import type { Project } from "@open-sunsama/types";
import { formatDuration } from "@/lib/utils";

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

/**
 * A project's planned time split three ways: done (completed tasks), on the
 * calendar (open tasks' time blocks) and not yet planned (the rest).
 * Nothing when no task has a planned time.
 */
export function ProjectTime({ project }: { project: Project }) {
  const total = project.totalMins ?? 0;
  if (total <= 0) return null;
  const done = Math.min(project.doneMins ?? 0, total);
  const scheduled = Math.min(project.scheduledMins ?? 0, total - done);
  const unplanned = total - done - scheduled;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span
        className="flex h-1.5 w-24 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${pct(done, total)}% of the time done, ${pct(scheduled, total)}% on the calendar`}
      >
        <span className="h-full bg-emerald-500" style={{ width: `${pct(done, total)}%` }} />
        <span className="h-full bg-primary/70" style={{ width: `${pct(scheduled, total)}%` }} />
      </span>
      <span className="font-medium tabular-nums text-foreground" title="Planned time of every task">
        {formatDuration(total)} total
      </span>
      <Part color="bg-emerald-500" mins={done} total={total} label="done" title="Planned time of completed tasks" />
      <Part
        color="bg-primary/70"
        mins={scheduled}
        total={total}
        label="on calendar"
        title="Open tasks' time blocks, up to each task's planned time"
      />
      {unplanned > 0 && (
        <Part color="bg-muted-foreground/30" mins={unplanned} total={total} label="not on calendar" title="Open tasks' planned time with no time block" />
      )}
    </div>
  );
}

function Part({
  color,
  mins,
  total,
  label,
  title,
}: {
  color: string;
  mins: number;
  total: number;
  label: string;
  title: string;
}) {
  return (
    <span className="flex items-center gap-1 tabular-nums" title={title}>
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {formatDuration(mins)} {label}
      <span className="text-muted-foreground/70">({pct(mins, total)}%)</span>
    </span>
  );
}
