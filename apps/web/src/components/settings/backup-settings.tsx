import * as React from "react";
import { AlertTriangle, Download, Loader2, Upload } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Separator,
} from "@/components/ui";
import { toast } from "@/hooks/use-toast";
import { getApiClient } from "@/lib/api";

interface BackupFile {
  format: string;
  version: number;
  exportedAt?: string;
  data: Record<string, unknown[]>;
}

const TABLE_LABELS: Record<string, string> = {
  projects: "Projects",
  tags: "Tags",
  taskTags: "Tags on tasks",
  tasks: "Tasks",
  subtasks: "Subtasks",
  taskSeries: "Routines",
  timeBlocks: "Time blocks",
  attachments: "Attachments",
  taskExternalLinks: "Linked items",
  ideaBoards: "Idea boards",
  ideaColumns: "Idea columns",
  ideas: "Ideas",
  ideaSubtasks: "Idea checklist items",
};

function countsOf(backup: BackupFile) {
  return Object.entries(backup.data)
    .map(([key, rows]) => ({ key, label: TABLE_LABELS[key] ?? key, count: rows.length }))
    .filter((entry) => entry.count > 0);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Settings → Backup. Export downloads all tasks, routines, time blocks and
 * ideas as one JSON file; restore replaces all of that with a file's contents.
 */
export function BackupSettings() {
  const [isExporting, setIsExporting] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [pending, setPending] = React.useState<{ name: string; backup: BackupFile } | null>(null);
  const [confirmText, setConfirmText] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await getApiClient().get<{ success: boolean; data: BackupFile }>(
        "backup/export",
        { timeout: 120_000 }
      );
      const backup = response.data;
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `open-sunsama-backup-${(backup.exportedAt ?? new Date().toISOString()).slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      const taskCount = backup.data.tasks?.length ?? 0;
      toast({ title: "Backup downloaded", description: `${taskCount} tasks saved.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Export failed", description: errorMessage(error) });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as BackupFile;
      if (parsed?.format !== "open-sunsama-backup" || typeof parsed.data !== "object") {
        throw new Error("This isn't an Open Sunsama backup file");
      }
      setConfirmText("");
      setPending({ name: file.name, backup: parsed });
    } catch (error) {
      toast({ variant: "destructive", title: "Can't read backup", description: errorMessage(error) });
    }
  };

  const handleRestore = async () => {
    if (!pending) return;
    setIsRestoring(true);
    try {
      const response = await getApiClient().post<{
        success: boolean;
        data: { counts: Record<string, number> };
      }>("backup/restore", { confirm: "REPLACE", backup: pending.backup }, { timeout: 120_000 });
      setPending(null);
      toast({
        title: "Backup restored",
        description: `${response.data.counts.tasks ?? 0} tasks restored.`,
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Restore failed", description: errorMessage(error) });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup</CardTitle>
        <CardDescription>
          Save your tasks, routines, time blocks and ideas to a JSON file, or restore from one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium">Export</p>
            <p className="text-xs text-muted-foreground">
              Download everything as a file. Attachments are saved as links, not file copies.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-2 h-3.5 w-3.5" />
            )}
            Export
          </Button>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium">Restore</p>
            <p className="text-xs text-muted-foreground">
              Replace all your current data with a backup file.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-3.5 w-3.5" />
            Restore…
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </CardContent>

      <Dialog open={!!pending} onOpenChange={(open) => !open && !isRestoring && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <DialogTitle>Replace all data?</DialogTitle>
                <DialogDescription>
                  Everything you have now is deleted and replaced by this backup.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {pending && (
            <div className="space-y-3 py-2">
              <div className="rounded-lg border bg-muted/50 p-3 text-[13px]">
                <p className="font-medium">{pending.name}</p>
                {pending.backup.exportedAt && (
                  <p className="text-xs text-muted-foreground">
                    Exported {new Date(pending.backup.exportedAt).toLocaleString()}
                  </p>
                )}
                <ul className="mt-2 grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                  {countsOf(pending.backup).map((entry) => (
                    <li key={entry.key} className="flex justify-between">
                      <span>{entry.label}</span>
                      <span className="tabular-nums">{entry.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                Export a backup of your current data first if you might want it back.
                Type <span className="font-mono font-medium text-foreground">REPLACE</span> to confirm.
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="REPLACE"
                autoFocus
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPending(null)} disabled={isRestoring}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRestore}
              disabled={isRestoring || confirmText !== "REPLACE"}
            >
              {isRestoring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Replace data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
