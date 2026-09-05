"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Coffee,
  Loader2,
  Pause,
  Play,
  Plus,
  Square,
} from "lucide-react";

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
import { SwitchTaskDialog } from "@/components/today/switch-task-dialog";
import { formatStopwatch } from "@/components/today/timer";
import { useStopwatch } from "@/components/today/use-stopwatch";
import { useTodayShortcuts } from "@/components/today/use-today-shortcuts";
import { useTodayState, type PendingAction } from "@/components/today/use-today-state";
import { cn } from "@/lib/utils";
import { formatHuman, minutesBetween, zonedClock } from "@/lib/time";
import type { AttendanceDTO, TimeEntryDTO } from "@/lib/types";

interface TodayScreenProps {
  timezone: string;
  /** Server timestamp — the client timer starts from server truth. */
  nowIso: string;
}

type StatusTone = "working" | "paused" | "break" | "off";

/** Daily work target (PRD: 8h/day, 40h/week — displayed only, never enforced). */
const TARGET_MINUTES = 480;

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
  const [switchTaskOpen, setSwitchTaskOpen] = useState(false);
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

  /**
   * "End Break & Resume" path: one click ends the break and resumes the
   * paused task. Paused here means the task was paused before the break —
   * the natural flow when stepping away.
   */
  const breakResumeTarget =
    onBreak && activeEntry?.status === "paused" ? activeEntry : null;

  async function handleEndBreak() {
    if (await endBreak()) {
      if (breakResumeTarget) await resumeTask();
    }
  }

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
              onSwitchTask={() => setSwitchTaskOpen(true)}
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
            <TargetProgress
              workMinutes={summary?.totals.workMinutes ?? 0}
              activeEntry={activeEntry}
              attendance={attendance}
              timezone={timezone}
              initialNowMs={initialNowMs}
            />
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
                  onClick={() =>
                    void (onBreak ? handleEndBreak() : startBreak())
                  }
                >
                  {pending === "break-start" || pending === "break-end" ? (
                    <Loader2 aria-hidden className="animate-spin" />
                  ) : (
                    <Coffee aria-hidden />
                  )}
                  {breakResumeTarget
                    ? `End Break & Resume ${truncateTask(breakResumeTarget.taskName)}`
                    : onBreak
                      ? "End Break"
                      : "Break"}
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

      {activeEntry ? (
        <SwitchTaskDialog
          open={switchTaskOpen}
          onOpenChange={setSwitchTaskOpen}
          currentTaskName={activeEntry.taskName}
          onSwitch={startTask}
        />
      ) : null}

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

/** Button-friendly task name: keep the first 18 chars plus an ellipsis. */
function truncateTask(name: string): string {
  return name.length > 20 ? `${name.slice(0, 18)}…` : name;
}

interface TargetProgressProps {
  workMinutes: number;
  activeEntry: TimeEntryDTO | null;
  attendance: AttendanceDTO | null;
  timezone: string;
  initialNowMs: number;
}

/**
 * Progress toward the 8-hour daily target. `workMinutes` is server truth as
 * of the last fetch; while a task runs, minutes elapsed since the server
 * timestamp are added live (never double-counted — the server already
 * counted up to fetch time). The projected wrap-up extrapolates the current
 * work-per-attendance pace to a clock-out time. Display only.
 */
function TargetProgress({
  workMinutes,
  activeEntry,
  attendance,
  timezone,
  initialNowMs,
}: TargetProgressProps) {
  const [nowMs, setNowMs] = useState(initialNowMs);

  useEffect(() => {
    if (activeEntry === null || activeEntry.status !== "active") return;
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [activeEntry]);

  const running = activeEntry !== null && activeEntry.status === "active";
  const liveMinutes = running
    ? minutesBetween(new Date(initialNowMs), new Date(nowMs))
    : 0;
  const totalWork = workMinutes + liveMinutes;
  const pct = Math.min(100, Math.round((totalWork / TARGET_MINUTES) * 100));
  const remaining = Math.max(0, TARGET_MINUTES - totalWork);

  let projected: string | null = null;
  if (attendance?.status === "open" && totalWork > 0) {
    const elapsed = minutesBetween(
      new Date(attendance.clockInAt),
      new Date(nowMs),
    );
    if (elapsed > 0) {
      const pace = totalWork / elapsed;
      const projectedDayMinutes = Math.ceil(TARGET_MINUTES / pace);
      projected = zonedClock(
        new Date(Date.parse(attendance.clockInAt) + projectedDayMinutes * 60_000),
        timezone,
      );
    }
  }

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="target-progress-block"
      aria-label={`Daily target progress: ${formatHuman(totalWork)} of ${formatHuman(TARGET_MINUTES)}`}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-base text-muted-foreground">Target</p>
        <p className="text-xl font-semibold tabular-nums" data-testid="target-progress-label">
          {formatHuman(Math.floor(totalWork))} / {formatHuman(TARGET_MINUTES)}{" "}
          <span className="text-base font-normal text-muted-foreground">
            ({pct}%)
          </span>
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={TARGET_MINUTES}
        aria-valuenow={Math.floor(totalWork)}
        data-testid="target-progress"
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground" data-testid="target-progress-remaining">
        {remaining > 0
          ? `${formatHuman(Math.ceil(remaining))} left`
          : "Target reached"}
        {projected && remaining > 0 ? ` · wrap up around ${projected}` : ""}
      </p>
    </div>
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
  onSwitchTask: () => void;
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
  onSwitchTask,
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
            variant="outline"
            className="h-11 min-w-28 px-5"
            data-testid="switch-task"
            disabled={busy}
            onClick={onSwitchTask}
          >
            {pending === "start-task" ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <ArrowRightLeft aria-hidden />
            )}
            Switch Task
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
                Clock in to begin tracking your time — or just start a task
                and the day opens with it.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
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
              <Button
                type="button"
                variant="outline"
                className="h-11 px-6"
                data-testid="log-activity"
                disabled={busy}
                onClick={onLogActivity}
              >
                <Plus aria-hidden />
                Log Activity
              </Button>
            </div>
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
