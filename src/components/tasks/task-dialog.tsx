"use client";

import { useMemo, useState } from "react";
import { Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/category-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { COLUMNS } from "@/components/tasks/task-constants";
import { apiFetch } from "@/components/timeline/api";
import type { CategoryDTO, TaskDTO, TaskPriority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TaskModalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskDTO | null;
  defaultColumn: TaskStatus;
  categories: CategoryDTO[];
  existingTasks: TaskDTO[];
  onSaved: (task: TaskDTO) => void;
  onDeleted: (taskId: string) => void;
}

export function TaskModalDialog({
  open,
  onOpenChange,
  task,
  defaultColumn,
  categories,
  existingTasks,
  onSaved,
  onDeleted,
}: TaskModalDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <TaskModalInner
        key={task?.id ?? defaultColumn ?? "new"}
        task={task}
        defaultColumn={defaultColumn}
        categories={categories}
        existingTasks={existingTasks}
        onOpenChange={onOpenChange}
        onSaved={onSaved}
        onDeleted={onDeleted}
      />
    </Dialog>
  );
}

function TaskModalInner({
  task,
  defaultColumn,
  categories,
  existingTasks,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  task: TaskDTO | null;
  defaultColumn: TaskStatus;
  categories: CategoryDTO[];
  existingTasks: TaskDTO[];
  onOpenChange: (open: boolean) => void;
  onSaved: (task: TaskDTO) => void;
  onDeleted: (taskId: string) => void;
}) {
  const isEditing = Boolean(task);

  const defaultCatId =
    task?.categoryId || categories.find((c) => c.key === "technology_innovation")?.id || categories[0]?.id || "";

  const [name, setName] = useState(task?.name || "");
  const [categoryId, setCategoryId] = useState<string>(defaultCatId);
  const [status, setStatus] = useState<TaskStatus>(task?.status || defaultColumn);
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || "medium");
  const [dueDate, setDueDate] = useState<string>(task?.dueAt ? task.dueAt.slice(0, 10) : "");
  const [description, setDescription] = useState(task?.description || "");
  const [isFavorite, setIsFavorite] = useState(task?.isFavorite ?? false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggest existing similar tasks when creating a new task to prevent accidental duplication
  const similarTasks = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (isEditing || q.length < 2) return [];
    return existingTasks
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 3);
  }, [name, existingTasks, isEditing]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Task name is required");
      return;
    }
    if (!categoryId) {
      setError("Please select a category");
      return;
    }

    setSaving(true);
    setError(null);

    const dueAtPayload = dueDate ? new Date(dueDate + "T23:59:59Z").toISOString() : null;

    try {
      if (isEditing && task) {
        const res = await apiFetch<TaskDTO>(`/api/tasks/${task.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            categoryId,
            status,
            priority,
            dueAt: dueAtPayload,
            description: description.trim() || null,
            isFavorite,
          }),
        });
        toast.success("Task updated");
        onSaved(res);
        onOpenChange(false);
      } else {
        const res = await apiFetch<TaskDTO>("/api/tasks", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            categoryId,
            status,
            priority,
            dueAt: dueAtPayload,
            description: description.trim() || null,
            isFavorite,
          }),
        });
        toast.success("Task created");
        onSaved(res);
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
      toast.error(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm("Are you sure you want to delete this task?")) return;

    setDeleting(true);
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      toast.success("Task deleted");
      onDeleted(task.id);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete task");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
      <div className="px-6 pt-5 pb-3 shrink-0 border-b border-border/40">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {isEditing ? "Edit Task" : "Create New Task"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modify task name, status, priority, and workflow details."
              : "Add a new task directly into your active workflow."}
          </DialogDescription>
        </DialogHeader>
      </div>

      {error && (
        <div className="mx-6 mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2 shrink-0">
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
        {/* Name */}
        <div className="space-y-1">
          <Label htmlFor="task-name" className="text-xs font-semibold text-foreground/80">
            Task Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="task-name"
            placeholder="e.g. Implement OAuth Flow"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving || deleting}
            autoFocus
            className="text-sm font-medium"
          />

          {/* Autocomplete / Duplication warning for similar tasks */}
          {similarTasks.length > 0 && (
            <div className="rounded-lg bg-muted/60 border border-border/80 p-2 text-xs text-muted-foreground space-y-1 mt-1">
              <span className="font-semibold text-foreground text-[10px]">
                Similar existing task found:
              </span>
              <div className="flex flex-wrap gap-1">
                {similarTasks.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setName(st.name);
                      setCategoryId(st.categoryId);
                      if (st.status) setStatus(st.status);
                      if (st.priority) setPriority(st.priority);
                    }}
                    className="px-2 py-0.5 rounded bg-background hover:bg-muted border border-border text-[11px] font-medium text-foreground transition-colors cursor-pointer"
                    title="Click to use this existing task name"
                  >
                    {st.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-foreground/80">Workflow Status</Label>
          <div className="grid grid-cols-5 gap-1.5">
            {COLUMNS.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => setStatus(col.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-lg border text-[11px] font-medium transition-all select-none cursor-pointer",
                  status === col.id
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                    : "border-border/70 hover:bg-muted text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    status === col.id ? "bg-primary-foreground" : col.dotColor,
                  )}
                />
                <span className="truncate">{col.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Priority & Due Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground/80">Priority</Label>
            <Select value={priority} onValueChange={(val: TaskPriority) => setPriority(val)}>
              <SelectTrigger className="w-full text-xs h-9">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">🔥 Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="due-date" className="text-xs font-semibold text-foreground/80">
              Due Date
            </Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={saving || deleting}
              className="text-xs h-9"
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-foreground/80">Category</Label>
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
            {categories.map((cat) => {
              const isSelected = categoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={cn(
                    "flex items-center gap-1.5 p-1.5 rounded-lg border text-left text-xs transition-all select-none cursor-pointer",
                    isSelected
                      ? "border-primary/60 bg-primary/10 text-primary font-semibold shadow-xs"
                      : "border-border/60 hover:border-border hover:bg-muted/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <CategoryBadge
                    categoryKey={cat.key}
                    categoryName={cat.name}
                    showIcon={false}
                    size="sm"
                    className="px-1 py-0 border-0 bg-transparent text-[11px]"
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="task-description" className="text-xs font-semibold text-foreground/80">
            Description / Notes
          </Label>
          <Textarea
            id="task-description"
            placeholder="Add context, specifications, links, or subtasks..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving || deleting}
            rows={3}
            className="text-xs min-h-[76px] max-h-[160px] resize-y leading-relaxed"
          />
        </div>

        {/* Favorite */}
        <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none pt-0.5">
          <input
            type="checkbox"
            checked={isFavorite}
            onChange={(e) => setIsFavorite(e.target.checked)}
            className="rounded border-input text-amber-500 focus:ring-amber-500 size-4"
          />
          <span className="flex items-center gap-1.5">
            <Star className={cn("size-3.5", isFavorite && "fill-amber-500 text-amber-500")} />
            Mark as favorite task
          </span>
        </label>
      </div>

      <DialogFooter className="flex flex-row items-center justify-between gap-2 px-6 py-3.5 border-t border-border/60 bg-muted/20 mt-auto shrink-0">
        <div>
          {isEditing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5"
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Delete
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving || deleting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || deleting}
            className="text-xs gap-1.5 font-medium shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {isEditing ? "Saving…" : "Creating…"}
              </>
            ) : isEditing ? (
              "Save Changes"
            ) : (
              "Create Task"
            )}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
