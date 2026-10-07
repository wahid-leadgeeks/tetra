"use client";

import { ArrowRightLeft, ListChecks, Loader2, Pause, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TaskMetaBadges } from "@/components/tasks/task-meta-badges";
import { TaskNotes } from "@/components/tasks/task-notes";
import { CategoryBadge } from "@/components/ui/category-badge";
import { formatStopwatch } from "@/components/today/timer";
import { useStopwatch } from "@/components/today/use-stopwatch";
import type { PendingAction } from "@/components/today/use-today-state";
import { zonedClock } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { TimeEntryDTO } from "@/lib/types";

interface ActiveTaskCardProps {
  entry: TimeEntryDTO;
  initialNowMs: number;
  /** IANA zone used to render the "Started HH:MM" subtitle. */
  timezone: string;
  busy: boolean;
  pending: PendingAction | null;
  onPauseTask: () => Promise<boolean>;
  onResumeTask: () => Promise<boolean>;
  onStopTask: () => void | Promise<boolean>;
  onSwitchTask: () => void;
  /** Opens the task editor; the Details button renders only with `entry.taskDetails`. */
  onOpenTask: () => void;
}

/**
 * The visual focus of the Today screen. Keyed by entry id so a new task
 * resets the stopwatch, while refetches of the same entry keep its state.
 */
export function ActiveTaskCard({
  entry,
  initialNowMs,
  timezone,
  busy,
  pending,
  onPauseTask,
  onResumeTask,
  onStopTask,
  onSwitchTask,
  onOpenTask,
}: ActiveTaskCardProps) {
  const { elapsedMs, paused } = useStopwatch(entry, initialNowMs);

  async function handleTogglePause() {
    if (paused) {
      await onResumeTask();
    } else {
      await onPauseTask();
    }
  }

  return (
    <Card
      className={cn(
        "border-2 transition-all shadow-xs",
        paused
          ? "border-amber-500/35 bg-amber-500/[0.02]"
          : "border-emerald-500/40 bg-emerald-500/[0.02] shadow-emerald-500/5",
      )}
    >
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <CategoryBadge
              categoryKey={entry.categoryKey}
              categoryName={entry.categoryName}
              size="sm"
            />
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold select-none",
                paused
                  ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  paused ? "bg-amber-500" : "bg-emerald-500 animate-pulse",
                )}
              />
              {paused ? "Paused · On Break" : "Live Tracking"}
            </span>
          </div>
          <p className="text-xl leading-snug font-semibold md:text-2xl text-foreground">
            {entry.taskName}
          </p>
          <TaskMetaBadges details={entry.taskDetails} timezone={timezone} />
          {entry.taskDetails?.description ? (
            <div data-testid="active-task-description">
              <TaskNotes
                variant="clamp"
                text={entry.taskDetails.description}
                onOpen={onOpenTask}
              />
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Started {zonedClock(new Date(entry.startedAt), timezone)}
          </p>
        </div>

        <p
          role="timer"
          aria-label="Elapsed time"
          data-testid="active-timer"
          className={cn(
            "text-5xl font-bold tracking-tight tabular-nums md:text-6xl text-foreground",
            paused && "text-muted-foreground",
          )}
        >
          {formatStopwatch(elapsedMs)}
        </p>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <Button
            type="button"
            className="h-11 min-w-0 px-2 font-medium sm:min-w-28 sm:px-5"
            data-testid={paused ? "resume-task" : "pause-task"}
            disabled={busy}
            onClick={() => void handleTogglePause()}
          >
            {pending === "pause-task" || pending === "resume-task" ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : paused ? (
              <Play aria-hidden />
            ) : (
              <Pause aria-hidden />
            )}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-11 min-w-0 px-2 font-medium sm:min-w-28 sm:px-5"
            data-testid="switch-task"
            disabled={busy}
            onClick={onSwitchTask}
          >
            {pending === "start-task" ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <ArrowRightLeft aria-hidden />
            )}
            <span className="sm:hidden">Switch</span>
            <span className="hidden sm:inline">Switch Task</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 min-w-0 border-destructive/30 px-2 font-medium text-destructive hover:bg-destructive/10 hover:text-destructive sm:min-w-28 sm:px-5"
            data-testid="stop-task"
            disabled={busy}
            onClick={() => void onStopTask()}
          >
            {pending === "stop-task" ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <Square aria-hidden />
            )}
            Stop
          </Button>
        </div>

        {entry.taskDetails ? (
          <div className="-mt-3 flex">
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3 text-xs"
              data-testid="active-task-details"
              onClick={onOpenTask}
            >
              <ListChecks aria-hidden className="size-3.5" />
              Details
            </Button>
          </div>
        ) : null}

        {entry.notes ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {entry.notes}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
