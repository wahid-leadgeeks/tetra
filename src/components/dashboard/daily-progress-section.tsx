"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, Clock, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressKpiCard } from "@/components/dashboard/progress-kpi-card";
import { isBlockingWarning } from "@/features/daily-summary/domain";
import { formatDiffHuman } from "@/features/dashboard/domain";
import type { DailyProgressDTO } from "@/features/dashboard/types";
import { formatHuman, zonedClock } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface DailyProgressSectionProps {
  daily: DailyProgressDTO;
  timezone: string;
}

export function DailyProgressSection({ daily, timezone }: DailyProgressSectionProps) {
  const hasAttendance = Boolean(daily.attendance?.clockInAt);
  const isClockedIn = daily.attendance?.status === "open";

  const formattedClockIn = daily.attendance?.clockInAt
    ? zonedClock(new Date(daily.attendance.clockInAt), timezone)
    : "—";

  const formattedClockOut = daily.attendance?.clockOutAt
    ? zonedClock(new Date(daily.attendance.clockOutAt), timezone)
    : isClockedIn
      ? "Active"
      : "—";

  const activeCategoriesCount = daily.categoryBreakdown.filter((c) => c.minutes > 0).length;
  const issueCount = daily.warnings.filter(isBlockingWarning).length;

  return (
    <div data-testid="daily-progress-section" className="grid gap-6">
      {/* Work Time Target KPI */}
      <ProgressKpiCard
        testId="daily-kpi"
        title={`${daily.dayOfWeek} Work vs Target`}
        workMinutes={daily.workMinutes}
        targetMinutes={daily.targetMinutes}
        diff={formatDiffHuman(daily.diffMinutes)}
        diffLabel="vs 8h target"
        weekend={daily.isWeekend}
        progressPct={daily.progressPct}
        attendanceMinutes={daily.attendanceMinutes}
        breakMinutes={daily.breakMinutes}
        icon={Clock}
        subtext={
          daily.isWorkday
            ? `${daily.dayOfWeek} (8h target)`
            : `${daily.dayOfWeek} (Weekend / Non-workday)`
        }
      />

      {/* Compact attendance line */}
      <Card
        data-testid="daily-attendance-line"
        className="flex flex-row flex-wrap items-center gap-x-4 gap-y-2 border-border/80 bg-card px-4 py-3 text-xs shadow-xs"
      >
        <div className="flex items-center gap-2">
          <CalendarDays aria-hidden className="size-4 text-muted-foreground" />
          <span className="font-semibold text-foreground">Attendance</span>
        </div>

        <span className="font-mono tabular-nums text-foreground">
          {formattedClockIn} → {formattedClockOut}
        </span>

        <span className="font-mono font-semibold tabular-nums text-foreground">
          {formatHuman(daily.attendanceMinutes)}
        </span>

        {hasAttendance ? (
          <Badge
            variant={isClockedIn ? "default" : "secondary"}
            className={cn(
              "text-xs font-semibold",
              isClockedIn
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {isClockedIn ? "In Progress" : "Completed"}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            No Attendance Logged
          </Badge>
        )}

        {daily.timeEntriesCount > 0 && (
          <span className="text-muted-foreground sm:ml-auto">
            <strong className="text-foreground">{daily.timeEntriesCount}</strong>{" "}
            {daily.timeEntriesCount === 1 ? "entry" : "entries"} ·{" "}
            <strong className="text-foreground">{activeCategoriesCount}</strong>{" "}
            {activeCategoriesCount === 1 ? "category" : "categories"}
          </span>
        )}
      </Card>

      {/* Daily Review link: category breakdown and warnings live in Reports */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-0.5">
            <p className="font-heading text-sm font-semibold text-foreground">Daily Review</p>
            <p className="text-xs text-muted-foreground">
              Category breakdown, warnings, and sync for this day
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/reports?date=${daily.date}`} data-testid="dashboard-open-report-link">
              {issueCount > 0 && (
                <AlertTriangle aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" />
              )}
              <span>
                Open Daily Review
                {issueCount > 0 ? ` · ${issueCount} ${issueCount === 1 ? "issue" : "issues"}` : ""}
              </span>
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Quick Action Navigation */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/timeline?date=${daily.date}`}>
            <Clock aria-hidden className="size-3.5" />
            <span>Timeline</span>
            <ExternalLink aria-hidden className="size-3 text-muted-foreground" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
