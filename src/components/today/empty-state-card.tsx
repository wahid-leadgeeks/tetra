"use client";

import { Loader2, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type EmptyStateMode = "not-clocked-in" | "no-task" | "done";

interface EmptyStateCardProps {
  mode: EmptyStateMode;
  clockOutLabel: string | null;
  busy: boolean;
  clockInPending: boolean;
  onClockIn: () => void;
  onLogActivity: () => void;
  onOpenTour?: () => void;
}

/**
 * Calm empty state for "no task running", contextual to the work day:
 * start the day, start a task, or review a finished one.
 */
export function EmptyStateCard({
  mode,
  clockOutLabel,
  busy,
  clockInPending,
  onClockIn,
  onLogActivity,
  onOpenTour,
}: EmptyStateCardProps) {
  return (
    <Card className="border border-border/80 overflow-hidden shadow-xs">
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-500" />
      <CardContent className="flex flex-col items-start gap-6 p-6">
        {mode === "not-clocked-in" ? (
          <>
            <div className="flex flex-col gap-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="size-3.5" />
                <span>Ready to track today</span>
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground">
                Start your work day
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Clock in to begin tracking attendance, or start a task directly and
                attendance opens automatically.
              </p>
            </div>

            {/* 3-step quick companion guide */}
            <div className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/40 p-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-[11px]">
                  1
                </span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Clock In:</strong> Start day
                </span>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/40 p-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-[11px]">
                  2
                </span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Track:</strong> Live timer
                </span>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/40 p-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-[11px]">
                  3
                </span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Sync:</strong> Write to Sheet
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full pt-1">
              <Button
                type="button"
                className="h-11 px-6 font-medium shadow-xs"
                data-testid="clock-in"
                disabled={busy}
                onClick={onClockIn}
              >
                {clockInPending ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : null}
                Start Work
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 px-6 font-medium"
                data-testid="log-activity"
                disabled={busy}
                onClick={onLogActivity}
              >
                <Plus aria-hidden />
                Log Activity
              </Button>
              {onOpenTour && (
                <button
                  type="button"
                  onClick={onOpenTour}
                  className="sm:ml-auto inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium cursor-pointer"
                >
                  <Sparkles className="size-3.5" />
                  New here? Take 1-min guide tour
                </button>
              )}
            </div>
          </>
        ) : mode === "no-task" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Clocked in & attending</span>
              </div>
              <p className="text-lg font-semibold text-foreground">No task running</p>
              <p className="text-sm text-muted-foreground">
                Start a task to track what you&apos;re working on, or step away for a break.
              </p>
            </div>
            <Button
              type="button"
              className="h-11 px-6 font-medium"
              data-testid="log-activity"
              disabled={busy}
              onClick={onLogActivity}
            >
              <Plus aria-hidden />
              Log Activity
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <p className="text-lg font-semibold text-foreground">Done for today</p>
              <p className="text-sm text-muted-foreground">
                {clockOutLabel
                  ? `You stopped tracking at ${clockOutLabel}.`
                  : "You've finished tracking for today."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 font-medium"
              data-testid="log-activity"
              disabled={busy}
              onClick={onLogActivity}
            >
              <Plus aria-hidden />
              Log Activity
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
