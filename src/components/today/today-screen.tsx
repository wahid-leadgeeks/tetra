"use client";

import { useMemo, useState } from "react";
import { Coffee, Loader2, Pause, Play, Plus, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StartTaskDialog } from "@/components/today/start-task-dialog";
import { QuickStart } from "@/components/today/quick-start";
import { StickyTaskBar } from "@/components/today/sticky-task-bar";
import { formatStopwatch } from "@/components/today/timer";
import { useStopwatch } from "@/components/today/use-stopwatch";
import { useTodayShortcuts } from "@/components/today/use-today-shortcuts";
import { useTodayState, type PendingAction } from "@/components/today/use-today-state";
import { cn } from "@/lib/utils";
import { formatHuman, zonedClock } from "@/lib/time";
import type { TimeEntryDTO } from "@/lib/types";

interface TodayScreenProps {
  timezone: string;
  /** Server timestamp — the client timer starts from server truth. */
  nowIso: string;
}

type StatusTone = "working" | "paused" | "break" | "off";

const STATUS_STYLES: Record<StatusTone, { label: string; dot: string }> = {
  working: { label: "Working", dot: "bg-emerald-500" },
  paused: { label: "Paused", dot: "bg-amber-500" },
  break: { label: "On Break", dot: "bg-sky-500" },
  off: { label: "Not clocked in", dot: "bg-muted-foreground/40" },
};

/**
 * Today screen (DESIGN.md): date, status, the active task with a live timer
 * as the visual focus, calm totals, and the work-day controls.
 */
export function TodayScreen({ timezone, nowIso }: TodayScreenProps) {
  const initialNowMs = useMemo(() => Date.parse(nowIso), [nowIso]);

  const {
    summary,
    loadState,
    pending,
    refresh,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    startTask,
    stopTask,
    pauseTask,
    resumeTask,
  } = useTodayState(timezone);

  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [stopWorkConfirmOpen, setStopWorkConfirmOpen] = useState(false);

  const attendance = summary?.attendance ?? null;
  const isWorking = attendance?.status === "open";
  const onBreak = attendance?.activeBreak != null;

  const activeEntry = useMemo<TimeEntryDTO | null>(() => {
    const entries = summary?.timeEntries ?? [];
    return (
      entries.find(
        (entry) => entry.status === "active" || entry.status === "paused",
      ) ?? null
    );
  }, [summary]);

  const status: StatusTone = !isWorking
    ? "off"
    : onBreak
      ? "break"
      : activeEntry?.status === "paused"
        ? "paused"
        : "working";

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: timezone,
      }).format(new Date(initialNowMs)),
    [timezone, initialNowMs],
  );

  const busy = pending !== null;
  const showSkeleton = loadState === "loading" && summary === null;
  const showError = loadState === "error" && summary === null;

  useTodayShortcuts({
    attendanceOpen: isWorking,
    canClockIn: attendance === null,
    hasActiveEntry: activeEntry !== null,
    isRunning: activeEntry?.status === "active",
    isPaused: activeEntry?.status === "paused",
    onBreak,
    busy,
    clockIn,
    openLogActivity: () => setLogActivityOpen(true),
    toggleBreak: () => void (onBreak ? endBreak() : startBreak()),
    togglePauseResume: () =>
      void (activeEntry?.status === "paused" ? resumeTask() : pauseTask()),
  });

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {dateLabel}
        </h1>
        <p className="flex items-center gap-2.5 text-sm font-medium">
          <span
            aria-hidden
            className={cn(
              "inline-block size-2 shrink-0 rounded-full",
              STATUS_STYLES[status].dot,
            )}
          />
          {STATUS_STYLES[status].label}
        </p>
      </header>

      {showSkeleton ? <LoadingCard /> : null}

      {showError ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-base font-medium">Couldn&apos;t load today</p>
              <p className="text-sm text-muted-foreground">
                Check your connection, then try again.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => void refresh()}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!showSkeleton && !showError ? (
        <>
          {activeEntry ? (
            <ActiveTaskCard
              key={activeEntry.id}
              entry={activeEntry}
              initialNowMs={initialNowMs}
              busy={busy}
              pending={pending}
              onPauseTask={pauseTask}
              onResumeTask={resumeTask}
              onStopTask={stopTask}
            />
          ) : (
            <EmptyStateCard
              mode={
                attendance === null
                  ? "not-clocked-in"
                  : attendance.status === "closed"
                    ? "done"
                    : "no-task"
              }
              clockOutLabel={
                attendance?.clockOutAt
                  ? zonedClock(new Date(attendance.clockOutAt), timezone)
                  : null
              }
              busy={busy}
              clockInPending={pending === "clock-in"}
              onClockIn={() => void clockIn()}
              onLogActivity={() => setLogActivityOpen(true)}
            />
          )}

          {activeEntry ? (
            <StickyTaskBar
              key={`sticky-${activeEntry.id}`}
              entry={activeEntry}
              initialNowMs={initialNowMs}
              busy={busy}
              onPause={pauseTask}
              onResume={resumeTask}
              onStop={stopTask}
            />
          ) : null}

          <QuickStart timeZone={timezone} refresh={() => void refresh()} />

          <section aria-labelledby="today-totals" className="flex flex-col gap-4">
            <h2
              id="today-totals"
              className="text-sm font-medium text-muted-foreground"
            >
              Today
            </h2>
            <dl className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <dt className="text-base text-muted-foreground">Work</dt>
                <dd
                  data-testid="today-work-total"
                  className="text-xl font-semibold tabular-nums"
                >
                  {formatHuman(summary?.totals.workMinutes ?? 0)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-base text-muted-foreground">Break</dt>
                <dd
                  data-testid="today-break-total"
                  className="text-xl font-semibold tabular-nums"
                >
                  {formatHuman(summary?.totals.breakMinutes ?? 0)}
                </dd>
              </div>
            </dl>
          </section>

          <div className="flex flex-col gap-3">
            {activeEntry ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full sm:w-auto sm:px-6"
                data-testid="log-activity"
                disabled={busy}
                onClick={() => setLogActivityOpen(true)}
              >
                <Plus aria-hidden />
                Log Activity
              </Button>
            ) : null}

            {isWorking ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  data-testid={onBreak ? "break-end" : "break-start"}
                  disabled={busy}
                  onClick={() => void (onBreak ? endBreak() : startBreak())}
                >
                  {pending === "break-start" || pending === "break-end" ? (
                    <Loader2 aria-hidden className="animate-spin" />
                  ) : (
                    <Coffee aria-hidden />
                  )}
                  {onBreak ? "End Break" : "Break"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11"
                  data-testid="clock-out"
                  disabled={busy}
                  onClick={() => setStopWorkConfirmOpen(true)}
                >
                  Stop Work
                </Button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <StartTaskDialog
        open={logActivityOpen}
        onOpenChange={setLogActivityOpen}
        onStart={startTask}
      />

      <Dialog
        open={stopWorkConfirmOpen}
        onOpenChange={setStopWorkConfirmOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop work for today?</DialogTitle>
            <DialogDescription>
              {onBreak
                ? "Your open break ends now and your attendance closes for the day."
                : "Your attendance closes for the day. You can still review everything on the Timeline."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setStopWorkConfirmOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              data-testid="clock-out-confirm"
              disabled={busy}
              onClick={() => {
                setStopWorkConfirmOpen(false);
                void clockOut();
              }}
            >
              {pending === "clock-out" ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : null}
              Stop Work
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoadingCard() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="h-5 w-1/3 animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-2/5 animate-pulse rounded-md bg-muted" />
        <p className="text-sm text-muted-foreground">Loading your day…</p>
      </CardContent>
    </Card>
  );
}

interface ActiveTaskCardProps {
  entry: TimeEntryDTO;
  initialNowMs: number;
  busy: boolean;
  pending: PendingAction | null;
  onPauseTask: () => Promise<boolean>;
  onResumeTask: () => Promise<boolean>;
  onStopTask: () => Promise<boolean>;
}

/**
 * The visual focus of the Today screen. Keyed by entry id so a new task
 * resets the stopwatch, while refetches of the same entry keep its state.
 */
function ActiveTaskCard({
  entry,
  initialNowMs,
  busy,
  pending,
  onPauseTask,
  onResumeTask,
  onStopTask,
}: ActiveTaskCardProps) {
  const { elapsedMs, paused, markPaused, markResumed } = useStopwatch(
    entry,
    initialNowMs,
  );

  async function handleTogglePause() {
    if (paused) {
      if (await onResumeTask()) markResumed();
    } else {
      if (await onPauseTask()) markPaused();
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <p className="text-lg leading-snug font-medium md:text-xl">
            {entry.taskName}
          </p>
          <p className="text-sm text-muted-foreground">{entry.categoryName}</p>
        </div>

        <p
          role="timer"
          aria-label="Elapsed time"
          data-testid="active-timer"
          className={cn(
            "text-5xl font-semibold tracking-tight tabular-nums md:text-6xl",
            paused && "text-muted-foreground",
          )}
        >
          {formatStopwatch(elapsedMs)}
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-w-28 px-5"
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
            className="h-11 min-w-28 px-5"
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

        {entry.notes ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {entry.notes}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

type EmptyStateMode = "not-clocked-in" | "no-task" | "done";

interface EmptyStateCardProps {
  mode: EmptyStateMode;
  clockOutLabel: string | null;
  busy: boolean;
  clockInPending: boolean;
  onClockIn: () => void;
  onLogActivity: () => void;
}

/**
 * Calm empty state for "no task running", contextual to the work day:
 * start the day, start a task, or review a finished one.
 */
function EmptyStateCard({
  mode,
  clockOutLabel,
  busy,
  clockInPending,
  onClockIn,
  onLogActivity,
}: EmptyStateCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-5">
        {mode === "not-clocked-in" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <p className="text-base font-medium">Start your work day</p>
              <p className="text-sm text-muted-foreground">
                Clock in to begin tracking your time.
              </p>
            </div>
            <Button
              type="button"
              className="h-11 px-6"
              data-testid="clock-in"
              disabled={busy}
              onClick={onClockIn}
            >
              {clockInPending ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : null}
              Start Work
            </Button>
          </>
        ) : mode === "no-task" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <p className="text-base font-medium">No task running</p>
              <p className="text-sm text-muted-foreground">
                Start a task to track what you&apos;re working on.
              </p>
            </div>
            <Button
              type="button"
              className="h-11 px-6"
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
              <p className="text-base font-medium">Done for today</p>
              <p className="text-sm text-muted-foreground">
                {clockOutLabel
                  ? `You stopped tracking at ${clockOutLabel}.`
                  : "You've finished tracking for today."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11"
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
