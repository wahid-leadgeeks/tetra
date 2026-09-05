"use client";

/**
 * Switch task dialog (plan: 1-tap task switcher): pick a favorite or recent
 * task to switch to. Starting it stops the current task on the server in
 * the same transaction — zero overlap by design, no separate stop step.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/components/timeline/api";
import type { TaskDTO } from "@/lib/types";

interface SwitchTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The task currently running; it is excluded from the pick list. */
  currentTaskName: string;
  onSwitch: (input: { taskName: string; categoryId: string }) => Promise<unknown | null>;
}

type PickState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; tasks: TaskDTO[] };

export function SwitchTaskDialog({
  open,
  onOpenChange,
  currentTaskName,
  onSwitch,
}: SwitchTaskDialogProps) {
  const [pick, setPick] = useState<PickState>({ phase: "loading" });
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiFetch<TaskDTO[]>("/api/tasks/recent")
      .then((tasks) => {
        if (!cancelled) setPick({ phase: "ready", tasks });
      })
      .catch(() => {
        if (cancelled) return;
        setPick((prev) => (prev.phase === "ready" ? prev : { phase: "error" }));
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleSwitch(task: TaskDTO) {
    setSwitchingTo(task.id);
    const entry = await onSwitch({
      taskName: task.name,
      categoryId: task.categoryId,
    });
    setSwitchingTo(null);
    if (entry !== null && entry !== undefined) onOpenChange(false);
  }

  const tasks =
    pick.phase === "ready"
      ? pick.tasks.filter((task) => task.name !== currentTaskName).slice(0, 6)
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Switch task</DialogTitle>
          <DialogDescription>
            Your current task stops the moment the next one starts — no
            overlap, no gap.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2" data-testid="switch-task-list">
          {pick.phase === "loading" ? (
            <p className="text-sm text-muted-foreground">Loading tasks…</p>
          ) : pick.phase === "error" ? (
            <p className="text-sm text-destructive">
              Couldn&apos;t load recent tasks.
            </p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No other recent tasks yet — start one by name instead.
            </p>
          ) : (
            tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                data-testid={`switch-task-option-${task.id}`}
                className="inline-flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-input px-4 text-left text-sm outline-none transition-colors select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                disabled={switchingTo !== null}
                onClick={() => void handleSwitch(task)}
              >
                <span className="truncate font-medium">{task.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {task.isFavorite ? "Favorite" : "Recent"}
                  {switchingTo === task.id ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
