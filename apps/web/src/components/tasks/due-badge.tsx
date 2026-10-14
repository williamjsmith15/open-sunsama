import * as React from "react";
import { addDays, format, parseISO } from "date-fns";
import { CalendarClock, Lock } from "lucide-react";
import type { TaskDependencyRef } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import { isBlocked } from "@/lib/project-schedule";

export type DueState = "overdue" | "soon" | "later";

/** Overdue before today; "soon" today or tomorrow; otherwise later. */
export function dueState(dueDate: string, now = new Date()): DueState {
  const today = format(now, "yyyy-MM-dd");
  const tomorrow = format(addDays(now, 1), "yyyy-MM-dd");
  if (dueDate < today) return "overdue";
  if (dueDate <= tomorrow) return "soon";
  return "later";
}

export function dueLabel(dueDate: string, now = new Date()): string {
  const today = format(now, "yyyy-MM-dd");
  const tomorrow = format(addDays(now, 1), "yyyy-MM-dd");
  if (dueDate === today) return "Due today";
  if (dueDate === tomorrow) return "Due tomorrow";
  const d = parseISO(dueDate);
  const sameYear = d.getFullYear() === now.getFullYear();
  const text = format(d, sameYear ? "MMM d" : "MMM d, yyyy");
  return dueDate < today ? `Overdue · ${text}` : `Due ${text}`;
}

const DUE_TONE: Record<DueState, string> = {
  overdue: "text-red-500 dark:text-red-400",
  soon: "text-amber-600 dark:text-amber-400",
  later: "text-muted-foreground",
};

/** "Due Oct 20" in muted, amber or red. Nothing for done tasks or no date. */
export function DueBadge({
  dueDate,
  completed,
  className,
}: {
  dueDate: string | null | undefined;
  completed?: boolean;
  className?: string;
}) {
  if (!dueDate || completed) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[11px] font-medium tabular-nums leading-4",
        DUE_TONE[dueState(dueDate)],
        className
      )}
    >
      <CalendarClock className="h-3 w-3" />
      {dueLabel(dueDate)}
    </span>
  );
}

/** Lock shown while any blocker is open; the title lists what it waits on. */
export function BlockedBadge({
  blockedBy,
  className,
}: {
  blockedBy: TaskDependencyRef[] | undefined;
  className?: string;
}) {
  if (!isBlocked({ blockedBy })) return null;
  const open = (blockedBy ?? []).filter((b) => !b.completedAt);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium leading-4 text-muted-foreground",
        className
      )}
      title={`Waiting on: ${open.map((b) => b.title).join(", ")}`}
      aria-label={`Blocked by ${open.length} task${open.length === 1 ? "" : "s"}`}
    >
      <Lock className="h-3 w-3" />
      {open.length > 1 && <span className="tabular-nums">{open.length}</span>}
    </span>
  );
}
