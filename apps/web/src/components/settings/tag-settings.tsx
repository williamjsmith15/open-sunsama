import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Tag } from "@open-sunsama/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from "@/hooks/useTags";
import { COLOR_OPTIONS } from "@/components/calendar/time-block-form-sections";

const TAG_COLORS = [...COLOR_OPTIONS, { value: "#6B7280", label: "Gray" }];

function ColorSwatch({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Change colour"
          className="h-4 w-4 shrink-0 rounded-full ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          style={{ backgroundColor: color }}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-auto gap-1.5 p-2">
        {TAG_COLORS.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.label}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
            className={cn(
              "h-5 w-5 rounded-full",
              option.value.toLowerCase() === color.toLowerCase() && "ring-2 ring-ring ring-offset-2 ring-offset-background"
            )}
            style={{ backgroundColor: option.value }}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}

function TagRow({ tag }: { tag: Tag }) {
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const [name, setName] = React.useState(tag.name);
  React.useEffect(() => setName(tag.name), [tag.name]);

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) setName(tag.name);
    else if (trimmed !== tag.name) updateTag.mutate({ id: tag.id, input: { name: trimmed } });
  };

  return (
    <div className="group flex items-center gap-3 rounded-md px-2 py-1 hover:bg-muted/50">
      <ColorSwatch color={tag.color} onChange={(color) => updateTag.mutate({ id: tag.id, input: { color } })} />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveName}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setName(tag.name);
            e.currentTarget.blur();
          }
        }}
        maxLength={60}
        aria-label="Tag name"
        className="h-7 min-w-0 flex-1 rounded bg-transparent px-1 text-[13px] outline-hidden focus:bg-background focus:ring-1 focus:ring-ring"
      />
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {tag.openTaskCount ?? 0} open
      </span>
      <button
        type="button"
        aria-label={`Delete ${tag.name}`}
        onClick={() => {
          if (window.confirm(`Delete #${tag.name}? It comes off every task.`)) deleteTag.mutate(tag.id);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Settings → Tasks → Tags: rename, recolour and delete tags. */
export function TagSettings() {
  const { data: tags = [], isLoading } = useTags();
  const createTag = useCreateTag();
  const [newName, setNewName] = React.useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tags</CardTitle>
        <CardDescription>Labels you can put on any task, across projects.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = newName.trim().replace(/^#/, "");
            if (!trimmed) return;
            const color = TAG_COLORS[tags.length % TAG_COLORS.length]?.value ?? "#6B7280";
            createTag.mutate({ name: trimmed, color }, { onSuccess: () => setNewName("") });
          }}
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New tag"
            maxLength={60}
            className="h-8"
          />
          <button
            type="submit"
            disabled={!newName.trim() || createTag.isPending}
            className="flex h-8 shrink-0 items-center gap-1 rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </form>
        {isLoading ? null : tags.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            No tags yet. Add one here, or from a task's Tags field.
          </p>
        ) : (
          <div className="-mx-2">
            {tags.map((tag) => (
              <TagRow key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
