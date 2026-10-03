"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { formatHuman, minutesBetween, zonedClock } from "@/lib/time";
import type { AttendanceDTO, TimeEntryDTO } from "@/lib/types";

/** Daily work target (PRD: 8h/day, 40h/week — displayed only, never enforced). */
const TARGET_MINUTES = 480;

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
export function TargetProgress({
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
