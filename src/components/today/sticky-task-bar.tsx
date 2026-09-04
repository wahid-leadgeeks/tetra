"use client";

import { Pause, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatStopwatch } from "@/components/today/timer";
import { useStopwatch } from "@/components/today/use-stopwatch";
import { cn } from "@/lib/utils";
import type { TimeEntryDTO } from "@/lib/types";

interface StickyTaskBarProps {
  entry: TimeEntryDTO;
  /** Server timestamp — the bar's stopwatch starts from server truth. */
  initialNowMs: number;
  /** A mutation is in flight — controls are disabled. */
  busy: boolean;
  onPause: () => Promise<boolean>;
  onResume: () => Promise<boolean>;
  onStop: () => void | Promise<boolean>;
}

/**
 * Sticky active-task control for mobile (DESIGN.md: "sticky active-task
 * control"). A compact fixed bar sitting above the bottom navigation with
 * the task name, a live timer, and large Pause/Stop touch targets. Hidden
 * on desktop, where the full ActiveTaskCard carries the same controls.
 *
 * Mirrors ActiveTaskCard: it owns a useStopwatch instance and marks it
 * paused/resumed after the corresponding mutation succeeds.
 */
export function StickyTaskBar({
  entry,
  initialNowMs,
  busy,
  onPause,
  onResume,
  onStop,
}: StickyTaskBarProps) {
  const { elapsedMs, paused, markPaused, markResumed } = useStopwatch(
    entry,
    initialNowMs,
  );

  async function handleTogglePause() {
    if (paused) {
      if (await onResume()) markResumed();
    } else {
      if (await onPause()) markPaused();
    }
  }

  return (
    <div
      data-testid="sticky-task-bar"
      className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
    >
      <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-sm leading-snug font-medium">
            {entry.taskName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {entry.categoryName}
          </p>
        </div>

        <p
          role="timer"
          aria-label="Elapsed time"
          data-testid="sticky-timer"
          className={cn(
            "shrink-0 text-base font-semibold tabular-nums",
            paused && "text-muted-foreground",
          )}
        >
          {formatStopwatch(elapsedMs)}
        </p>

        <Button
          type="button"
          variant="outline"
          className="size-11 px-0"
          data-testid={paused ? "sticky-resume" : "sticky-pause"}
          aria-label={paused ? "Resume task" : "Pause task"}
          disabled={busy}
          onClick={() => void handleTogglePause()}
        >
          {paused ? (
            <Play aria-hidden className="size-5" />
          ) : (
            <Pause aria-hidden className="size-5" />
          )}
        </Button>

        <Button
          type="button"
          className="size-11 px-0"
          data-testid="sticky-stop"
          aria-label="Stop task"
          disabled={busy}
          onClick={() => void onStop()}
        >
          <Square aria-hidden className="size-5" />
        </Button>
      </div>
    </div>
  );
}
