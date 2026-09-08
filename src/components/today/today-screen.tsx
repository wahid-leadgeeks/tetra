"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Clock,
  Coffee,
  Loader2,
  Pause,
  Play,
  Plus,
  Sparkles,
  Square,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/category-badge";
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
import { useTour } from "@/components/guide-tour/tour-provider";
import { getCategoryTheme } from "@/lib/categories";
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
  const { openTour } = useTour();

  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [switchTaskOpen, setSwitchTaskOpen] = useState(false);
  const [stopWorkConfirmOpen, setStopWorkConfirmOpen] = useState(false);
  const [stopTaskConfirmOpen, setStopTaskConfirmOpen] = useState(false);

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

  // Protect against accidental tab close or page navigation while working
  useEffect(() => {
    if (!activeEntry && !isWorking) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [activeEntry, isWorking]);

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
    toggleBreak: () => void (onBreak ? handleEndBreak() : startBreak()),
    togglePauseResume: () =>
      void (activeEntry?.status === "paused" ? resumeTask() : pauseTask()),
  });

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {dateLabel}
          </h1>
          <p className="flex items-center gap-2.5 text-sm font-medium mt-1">
            <span
              aria-hidden
              className={cn(
                "inline-block size-2.5 shrink-0 rounded-full transition-all",
                STATUS_STYLES[status].dot,
                status === "working" && "animate-pulse ring-4 ring-emerald-500/20",
                status === "paused" && "ring-4 ring-amber-500/20",
                status === "break" && "ring-4 ring-sky-500/20",
              )}
            />
            {STATUS_STYLES[status].label}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openTour}
          data-testid="today-guide-tour"
          className="h-9 w-fit gap-2 border-primary/20 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <Sparkles className="size-3.5" />
          Guide Tour
        </Button>
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Active Task / Empty State + Actions + Quick Start */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div data-tour="today-hero" className="flex flex-col gap-6">
                {activeEntry ? (
                  <ActiveTaskCard
                    key={activeEntry.id}
                    entry={activeEntry}
                    initialNowMs={initialNowMs}
                    busy={busy}
                    pending={pending}
                    onPauseTask={pauseTask}
                    onResumeTask={resumeTask}
                    onStopTask={() => setStopTaskConfirmOpen(true)}
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
                    onOpenTour={openTour}
                  />
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-3">
                  {activeEntry ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full sm:w-auto sm:px-6 shadow-xs font-medium"
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
                        className="h-11 shadow-xs font-medium"
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
                        className="h-11 shadow-xs font-medium"
                        data-testid="clock-out"
                        disabled={busy}
                        onClick={() => setStopWorkConfirmOpen(true)}
                      >
                        Stop Work
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Quick Start Recents */}
              <QuickStart timeZone={timezone} refresh={() => void refresh()} />
            </div>

            {/* Right Column: Today Overview Panel */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <section
                aria-labelledby="today-totals"
                data-tour="today-overview"
                className="flex flex-col gap-5 rounded-2xl border border-border/80 bg-card p-6 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="today-totals"
                    className="font-heading text-lg font-semibold tracking-tight text-foreground"
                  >
                    Today Overview
                  </h2>
                  <span className="text-xs font-medium text-muted-foreground">
                    {attendance?.status === "open"
                      ? `In since ${zonedClock(new Date(attendance.clockInAt), timezone)}`
                      : attendance?.status === "closed"
                        ? "Day concluded"
                        : "Ready to start"}
                  </span>
                </div>

                {/* Prominent KPI Cards */}
                <dl className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-4 shadow-xs">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <Clock className="size-3.5 text-primary" />
                      Work Time
                    </dt>
                    <dd
                      data-testid="today-work-total"
                      className="text-3xl font-bold tracking-tight text-foreground tabular-nums"
                    >
                      {formatHuman(summary?.totals.workMinutes ?? 0)}
                    </dd>
                    <span className="text-[11px] text-muted-foreground">
                      Total tracked
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-4 shadow-xs">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <Coffee className="size-3.5 text-sky-500" />
                      Break Time
                    </dt>
                    <dd
                      data-testid="today-break-total"
                      className="text-3xl font-bold tracking-tight text-foreground tabular-nums"
                    >
                      {formatHuman(summary?.totals.breakMinutes ?? 0)}
                    </dd>
                    <span className="text-[11px] text-muted-foreground">
                      Rest & pauses
                    </span>
                  </div>
                </dl>

                {/* Target Progress Component */}
                <TargetProgress
                  workMinutes={summary?.totals.workMinutes ?? 0}
                  activeEntry={activeEntry}
                  attendance={attendance}
                  timezone={timezone}
                  initialNowMs={initialNowMs}
                />

                {/* Today's Category Distribution */}
                {summary && summary.byCategory.some((c) => c.minutes > 0) ? (
                  <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Time by Category</span>
                      <span className="text-muted-foreground">
                        {summary.byCategory.filter((c) => c.minutes > 0).length} active
                      </span>
                    </div>

                    <div
                      aria-label="Today category distribution"
                      className="h-2.5 w-full flex overflow-hidden rounded-full bg-muted shadow-inner"
                    >
                      {summary.byCategory
                        .filter((c) => c.minutes > 0)
                        .map((category) => {
                          const theme = getCategoryTheme(category.key);
                          const totalWork = summary.totals.workMinutes || 1;
                          const pct = Math.max(3, (category.minutes / totalWork) * 100);
                          return (
                            <div
                              key={category.key}
                              title={`${category.name}: ${formatHuman(category.minutes)}`}
                              style={{ width: `${pct}%` }}
                              className={cn("h-full transition-all duration-300", theme.barColor)}
                            />
                          );
                        })}
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1">
                      {summary.byCategory
                        .filter((c) => c.minutes > 0)
                        .map((category) => {
                          const theme = getCategoryTheme(category.key);
                          return (
                            <div
                              key={category.key}
                              className="flex items-center justify-between text-xs py-0.5"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  aria-hidden
                                  className={cn("size-2 rounded-full shrink-0", theme.dotClass)}
                                />
                                <span className="truncate text-muted-foreground font-medium">
                                  {category.name}
                                </span>
                              </div>
                              <span className="font-semibold text-foreground tabular-nums">
                                {formatHuman(category.minutes)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          </div>

          {activeEntry ? (
            <StickyTaskBar
              key={`sticky-${activeEntry.id}`}
              entry={activeEntry}
              initialNowMs={initialNowMs}
              busy={busy}
              onPause={pauseTask}
              onResume={resumeTask}
              onStop={() => setStopTaskConfirmOpen(true)}
            />
          ) : null}
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
        open={stopTaskConfirmOpen}
        onOpenChange={setStopTaskConfirmOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop current task?</DialogTitle>
            <DialogDescription>
              {activeEntry ? (
                <>
                  Stop tracking{" "}
                  <span className="font-semibold text-foreground">
                    {activeEntry.taskName}
                  </span>
                  ? This will record your elapsed time and finalize this entry
                  on today&apos;s timeline.
                </>
              ) : (
                "This will end tracking for the current task."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setStopTaskConfirmOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11"
              data-testid="stop-task-confirm"
              disabled={busy}
              onClick={() => {
                setStopTaskConfirmOpen(false);
                void stopTask();
              }}
            >
              {pending === "stop-task" ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : null}
              Stop Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

  const targetReached = totalWork >= TARGET_MINUTES;

  return (
    <div
      className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-card/60 p-4"
      data-testid="target-progress-block"
      aria-label={`Daily target progress: ${formatHuman(totalWork)} of ${formatHuman(TARGET_MINUTES)}`}
    >
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">Daily Target</p>
          {targetReached && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Completed! 🎉
            </span>
          )}
        </div>
        <p className="text-base font-semibold tabular-nums" data-testid="target-progress-label">
          {formatHuman(Math.floor(totalWork))} / {formatHuman(TARGET_MINUTES)}{" "}
          <span className="text-xs font-medium text-muted-foreground">
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
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted shadow-inner"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            targetReached
              ? "bg-emerald-500 shadow-sm shadow-emerald-500/40"
              : "bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-500 shadow-xs shadow-indigo-500/30",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground" data-testid="target-progress-remaining">
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
  onStopTask: () => void | Promise<boolean>;
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
              {paused ? "Paused" : "Live Tracking"}
            </span>
          </div>
          <p className="text-xl leading-snug font-semibold md:text-2xl text-foreground">
            {entry.taskName}
          </p>
          <p className="text-sm text-muted-foreground">{entry.categoryName}</p>
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

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-11 min-w-28 px-5 font-medium",
              paused &&
                "border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10",
            )}
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
            className="h-11 min-w-28 px-5 font-medium"
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
            className="h-11 min-w-28 px-5 font-medium"
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
  onOpenTour?: () => void;
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
