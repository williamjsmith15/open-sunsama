import * as React from "react";
import { Check, Hash, Plus, Search, X } from "lucide-react";
import type { Tag } from "@open-sunsama/types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { useCreateTag, useTagMap, useTags } from "@/hooks/useTags";
import { COLOR_OPTIONS } from "@/components/calendar/time-block-form-sections";

/** One tag as a small pill: "# name" in the tag's colour. */
export function TagPill({
  tag,
  className,
}: {
  tag: Pick<Tag, "name" | "color">;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-[8rem] items-center rounded px-1 text-[11px] font-medium leading-4",
        className
      )}
      style={{ color: tag.color, backgroundColor: `${tag.color}1F` }}
      title={tag.name}
    >
      <span className="truncate">#{tag.name}</span>
    </span>
  );
}

/** A task's tags; shows `max` and a "+N" for the rest. */
export function TagPills({
  tagIds,
  max = 2,
  className,
}: {
  tagIds: string[] | undefined;
  max?: number;
  className?: string;
}) {
  const tagMap = useTagMap();
  const list = (tagIds ?? [])
    .map((id) => tagMap.get(id))
    .filter((t): t is Tag => !!t)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  if (list.length === 0) return null;
  const shown = list.slice(0, max);
  const rest = list.slice(max);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1 overflow-hidden", className)}>
      {shown.map((tag) => (
        <TagPill key={tag.name} tag={tag} />
      ))}
      {rest.length > 0 && (
        <span
          className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
          title={rest.map((t) => `#${t.name}`).join(" ")}
        >
          +{rest.length}
        </span>
      )}
    </span>
  );
}

/**
 * Multi-select tag list for popovers: tick tags on and off, or type a new
 * name and press Enter to create and add it.
 */
export function TagMenu({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tagIds: string[]) => void;
}) {
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const [query, setQuery] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const q = query.trim().replace(/^#/, "");
  const visible = tags.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));
  const canCreate = q.length > 0 && !tags.some((t) => t.name.toLowerCase() === q.toLowerCase());
  const rowCount = visible.length + (canCreate ? 1 : 0);
  React.useEffect(() => setHighlight(0), [query]);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const create = async () => {
    const color = COLOR_OPTIONS[tags.length % COLOR_OPTIONS.length]?.value ?? "#6B7280";
    const tag = await createTag.mutateAsync({ name: q, color });
    onChange([...value, tag.id]);
    setQuery("");
  };

  const choose = (index: number) => {
    const tag = visible[index];
    if (tag) toggle(tag.id);
    else if (canCreate) void create();
  };

  return (
    <div
      className="w-60 p-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlight((h) => Math.min(h + 1, rowCount - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlight((h) => Math.max(h - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          choose(highlight);
        }
        // Keep task shortcuts from firing while typing here.
        e.stopPropagation();
      }}
    >
      <div className="flex items-center gap-1.5 border-b border-border/60 px-2 pb-1.5 pt-1">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add tags…"
          maxLength={60}
          className="h-6 min-w-0 flex-1 bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
        />
      </div>
      <div role="listbox" aria-multiselectable aria-label="Tags" className="max-h-64 overflow-y-auto pt-1">
        {visible.map((tag, i) => {
          const selected = value.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              role="option"
              aria-selected={selected}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => toggle(tag.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors focus:outline-hidden",
                i === highlight && "bg-accent"
              )}
            >
              <span
                className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border",
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                )}
              >
                {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
              <span className="min-w-0 flex-1 truncate">{tag.name}</span>
            </button>
          );
        })}
        {canCreate && (
          <button
            type="button"
            onMouseEnter={() => setHighlight(visible.length)}
            onClick={() => void create()}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors focus:outline-hidden",
              highlight === visible.length && "bg-accent"
            )}
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">Create #{q}</span>
          </button>
        )}
        {rowCount === 0 && (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">Type to create a tag</p>
        )}
      </div>
    </div>
  );
}

/** View filter: null shows everything, otherwise one tag's tasks. */
export type TagFilterValue = string | null;

export function matchesTagFilter(task: { tagIds?: string[] }, filter: TagFilterValue): boolean {
  return filter === null || (task.tagIds ?? []).includes(filter);
}

/** Toolbar control that narrows a view to one tag. */
export function TagFilter({
  value,
  onChange,
}: {
  value: TagFilterValue;
  onChange: (value: TagFilterValue) => void;
}) {
  const { data: tags = [], isSuccess } = useTags();
  const current = value ? tags.find((t) => t.id === value) : undefined;
  // A remembered filter for a tag that has since been deleted shows all.
  React.useEffect(() => {
    if (isSuccess && value && !current) onChange(null);
  }, [isSuccess, value, current, onChange]);
  if (tags.length === 0 && !value) return null;
  const item =
    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus:bg-accent focus:outline-hidden";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Tag filter: ${current?.name ?? "All tags"}`}
          className={cn(
            "flex h-8 max-w-[9rem] items-center gap-1.5 rounded-md px-2 text-xs transition-colors hover:bg-accent",
            value === null ? "text-muted-foreground" : "bg-accent text-foreground"
          )}
        >
          <Hash
            className="h-3.5 w-3.5 shrink-0"
            style={current ? { color: current.color } : undefined}
          />
          <span className="truncate">{current?.name ?? "Tags"}</span>
          {value !== null && (
            <span
              role="button"
              aria-label="Clear tag filter"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onChange(null);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="-mr-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-52 overflow-y-auto p-1">
        <DropdownMenuItem className={item} onClick={() => onChange(null)}>
          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1">All tags</span>
          {value === null && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>
        {tags.length > 0 && <div className="my-1 h-px bg-border/60" />}
        {tags.map((t) => (
          <DropdownMenuItem key={t.id} className={item} onClick={() => onChange(t.id)}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="min-w-0 flex-1 truncate">{t.name}</span>
            {value === t.id && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
