import * as React from "react";
import type { Project, ProjectStatus } from "@open-sunsama/types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/ui";
import { useCreateProject, useUpdateProject } from "@/hooks/useProjects";
import { BoardIcon } from "@/components/ideas/board-icon";
import { IconPicker } from "@/components/ideas/icon-picker";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

const DEFAULT_COLOR = "#6366F1";
const DEFAULT_ICON = "Folder";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the dialog edits this project; otherwise it creates one. */
  project?: Project;
  onCreated?: (projectId: string) => void;
}

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  onCreated,
}: ProjectDialogProps) {
  const isEdit = !!project;
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [icon, setIcon] = React.useState(DEFAULT_ICON);
  const [color, setColor] = React.useState(DEFAULT_COLOR);
  const [status, setStatus] = React.useState<ProjectStatus>("active");
  const [targetDate, setTargetDate] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const pending = createProject.isPending || updateProject.isPending;

  React.useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setIcon(project?.icon ?? DEFAULT_ICON);
    setColor(project?.color ?? DEFAULT_COLOR);
    setStatus(project?.status ?? "active");
    setTargetDate(project?.targetDate ?? "");
    setPickerOpen(false);
  }, [open, project]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const input = {
      name: trimmed,
      description: description.trim() || null,
      icon,
      color,
      status,
      targetDate: targetDate || null,
    };
    if (isEdit && project) {
      await updateProject.mutateAsync({ id: project.id, input });
      onOpenChange(false);
    } else {
      const created = await createProject.mutateAsync(input);
      onOpenChange(false);
      onCreated?.(created.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription>
              Group related tasks and track them to done.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Name</label>
              <div className="flex items-center gap-2.5">
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title="Choose icon and colour"
                      className="shrink-0 rounded-lg outline-hidden ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <BoardIcon icon={icon} color={color} size={36} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-1">
                    <IconPicker
                      icon={icon}
                      color={color}
                      onIconChange={setIcon}
                      onColorChange={setColor}
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kitchen renovation"
                  maxLength={120}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does done look like?"
                maxLength={5000}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Status</label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as ProjectStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {PROJECT_STATUS_LABELS[s]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Target date</label>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-5">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              {isEdit ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
