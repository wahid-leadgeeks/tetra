"use client";

import { useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import type {
  StartTaskInput,
} from "@/components/today/use-today-state";
import { getCategoryTheme } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { CategoryDTO, TaskDTO } from "@/lib/types";

interface StartTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (input: StartTaskInput) => Promise<unknown | null>;
}

type PickListState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; categories: CategoryDTO[]; recentTasks: TaskDTO[] };

/**
 * Start a task (DESIGN.md "Start task"): category select, task name,
 * recent-task chips, optional notes. Starting another task while one runs
 * replaces it — the server stops the previous entry.
 */
export function StartTaskDialog({
  open,
  onOpenChange,
  onStart,
}: StartTaskDialogProps) {
  const [pickList, setPickList] = useState<PickListState>({ phase: "loading" });
  const [reloadToken, setReloadToken] = useState(0);
  const [categoryId, setCategoryId] = useState("");
  const [taskName, setTaskName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/categories", { cache: "no-store" }),
      fetch("/api/tasks/recent", { cache: "no-store" }).catch(() => null),
    ])
      .then(async ([categoriesRes, tasksRes]) => {
        if (!categoriesRes.ok) throw new Error("categories request failed");
        const categories = (await categoriesRes.json()) as CategoryDTO[];
        const recentTasks =
          tasksRes !== null && tasksRes.ok
            ? ((await tasksRes.json()) as TaskDTO[])
            : [];
        return { categories, recentTasks };
      })
      .then((data) => {
        if (!cancelled) setPickList({ phase: "ready", ...data });
      })
      .catch(() => {
        if (cancelled) return;
        setPickList((prev) =>
          prev.phase === "ready" ? prev : { phase: "error" },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [open, reloadToken]);

  const trimmedName = taskName.trim();
  const canSubmit =
    !submitting && categoryId.length > 0 && trimmedName.length > 0;

  async function handleStart() {
    if (!canSubmit) return;
    setSubmitting(true);
    const entry = await onStart({
      taskName: trimmedName,
      categoryId,
      notes: notes.trim().length > 0 ? notes.trim() : undefined,
    });
    setSubmitting(false);
    if (entry !== null) {
      onOpenChange(false);
      setTaskName("");
      setNotes("");
    }
  }

  const categoryPlaceholder =
    pickList.phase === "loading"
      ? "Loading categories…"
      : pickList.phase === "error"
        ? "Couldn't load categories"
        : "Choose a category";

  const recentChips =
    pickList.phase === "ready" ? pickList.recentTasks.slice(0, 6) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a task</DialogTitle>
          <DialogDescription>
            Pick a category and name what you&apos;re working on.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="start-task-category">Category</Label>
            <div className="flex items-center gap-2">
              <Select
                value={categoryId}
                onValueChange={setCategoryId}
                disabled={
                  pickList.phase !== "ready" || submitting
                }
              >
                <SelectTrigger
                  id="start-task-category"
                  className="h-11 w-full"
                  data-testid="category-select"
                >
                  <SelectValue placeholder={categoryPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {pickList.phase === "ready"
                    ? pickList.categories.map((category) => {
                        const theme = getCategoryTheme(category.key);
                        return (
                          <SelectItem key={category.id} value={category.id}>
                            <span className="flex items-center gap-2">
                              <span
                                aria-hidden
                                className={cn("size-2 rounded-full shrink-0", theme.dotClass)}
                              />
                              <span>{category.name}</span>
                            </span>
                          </SelectItem>
                        );
                      })
                    : null}
                </SelectContent>
              </Select>
              {pickList.phase === "error" ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11"
                  onClick={() => setReloadToken((token) => token + 1)}
                  disabled={submitting}
                >
                  Retry
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="start-task-name">Task</Label>
            <Input
              id="start-task-name"
              data-testid="task-name-input"
              className="h-11"
              placeholder="What are you working on?"
              value={taskName}
              onChange={(event) => setTaskName(event.target.value)}
              disabled={submitting}
              maxLength={200}
            />
          </div>

          {recentChips.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Recent</p>
              <div className="flex flex-wrap gap-2">
                {recentChips.map((task) => {
                  const matchingCat =
                    pickList.phase === "ready"
                      ? pickList.categories.find((c) => c.id === task.categoryId)
                      : null;
                  const theme = getCategoryTheme(matchingCat?.key);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      className={cn(
                        "inline-flex h-10 items-center rounded-full border border-input px-3.5 text-xs text-foreground outline-none transition-all select-none hover:bg-muted/80 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
                        theme.hoverClass,
                      )}
                      onClick={() => {
                        setTaskName(task.name);
                        if (task.categoryId) setCategoryId(task.categoryId);
                      }}
                      disabled={submitting}
                    >
                      <span
                        aria-hidden
                        className={cn("mr-1.5 size-1.5 rounded-full shrink-0", theme.dotClass)}
                      />
                      {task.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="start-task-notes">
              Notes{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="start-task-notes"
              rows={3}
              placeholder="Anything worth remembering later"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-11"
            data-testid="start-task"
            disabled={!canSubmit}
            onClick={() => void handleStart()}
          >
            {submitting ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <Play aria-hidden />
            )}
            Start Timer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
