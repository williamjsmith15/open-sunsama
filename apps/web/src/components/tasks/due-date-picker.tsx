import * as React from "react";
import { addDays, format, nextMonday, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { MonthGrid } from "@/components/ui/month-grid";
import { cn } from "@/lib/utils";

/** Popover for a task's deadline: quick picks, a month grid, and clear. */
export function DueDatePicker({
  value,
  onChange,
  className,
  children,
}: {
  value: string | null;
  onChange: (date: string | null) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const pick = (date: Date | null) => {
    onChange(date ? format(date, "yyyy-MM-dd") : null);
    setOpen(false);
  };
  const now = new Date();
  const quick = [
    { label: "Today", date: now },
    { label: "Tomorrow", date: addDays(now, 1) },
    { label: "Next week", date: nextMonday(now) },
  ];
  const row =
    "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={className}>
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="p-1">
          <p className="px-2 pb-1 pt-1.5 text-xs text-muted-foreground">Due date</p>
          {quick.map((q) => (
            <button key={q.label} type="button" className={row} onClick={() => pick(q.date)}>
              <span>{q.label}</span>
              <span className="text-xs text-muted-foreground">{format(q.date, "EEE, MMM d")}</span>
            </button>
          ))}
        </div>
        <div className="border-t border-border/60">
          <MonthGrid selected={value ? parseISO(value) : null} onSelect={(d) => pick(d)} />
        </div>
        {value && (
          <div className="border-t border-border/60 p-1">
            <button type="button" className={cn(row, "text-muted-foreground")} onClick={() => pick(null)}>
              Clear due date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
