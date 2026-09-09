"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock,
  ExternalLink,
  LogIn,
  LogOut,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryPieChart } from "@/components/ui/category-pie-chart";
import { ProgressKpiCard } from "@/components/dashboard/progress-kpi-card";
import type { DailyProgressDTO } from "@/features/dashboard/types";
import { getCategoryTheme } from "@/lib/categories";
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

  const activeCategories = daily.categoryBreakdown.filter((c) => c.minutes > 0);

  return (
    <div data-testid="daily-progress-section" className="grid gap-6">
      {/* KPI & Attendance Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Work Time Target KPI */}
        <ProgressKpiCard
          testId="daily-kpi"
          title={`${daily.dayOfWeek} Work vs Target`}
          workMinutes={daily.workMinutes}
          targetMinutes={daily.targetMinutes}
          diff={daily.diff}
          progressPct={daily.progressPct}
          attendanceMinutes={daily.attendanceMinutes}
          breakMinutes={daily.breakMinutes}
          icon={Clock}
          subtext={
            daily.isWorkday
              ? `${daily.dayOfWeek} (Standard 8:00 target)`
              : `${daily.dayOfWeek} (Weekend / Non-workday)`
          }
        />

        {/* Attendance Summary Card */}
        <Card className="border-border/80 bg-card shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <CalendarDays aria-hidden className="size-4" />
                </div>
                <CardTitle className="font-heading text-sm font-semibold text-foreground">
                  Attendance Session
                </CardTitle>
              </div>

              {hasAttendance ? (
                <Badge
                  variant={isClockedIn ? "default" : "secondary"}
                  className={cn(
                    "font-semibold text-xs",
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
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Clock in/out records and break intervals
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LogIn aria-hidden className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Clock In</span>
                </div>
                <span className="font-mono text-base font-bold text-foreground tabular-nums">
                  {formattedClockIn}
                </span>
              </div>

              <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LogOut aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Clock Out</span>
                </div>
                <span className="font-mono text-base font-bold text-foreground tabular-nums">
                  {formattedClockOut}
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1 flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock aria-hidden className="size-3.5 text-primary" />
                  <span>Attendance</span>
                </div>
                <span className="font-mono text-base font-bold text-foreground tabular-nums">
                  {formatHuman(daily.attendanceMinutes)}
                </span>
              </div>
            </div>

            {daily.timeEntriesCount > 0 && (
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{daily.timeEntriesCount}</strong> time{" "}
                {daily.timeEntriesCount === 1 ? "entry" : "entries"} tracked across{" "}
                <strong className="text-foreground">{activeCategories.length}</strong>{" "}
                {activeCategories.length === 1 ? "category" : "categories"}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Warnings Block (if any) */}
      {daily.warnings.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle aria-hidden className="size-4 shrink-0" />
              <CardTitle className="font-heading text-sm font-semibold">
                Daily Warnings ({daily.warnings.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {daily.warnings.map((w, idx) => (
              <p key={idx} className="text-xs text-amber-800 dark:text-amber-300">
                • {w.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Category Breakdown Card */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden className="size-4 text-primary" />
              <CardTitle className="font-heading text-sm font-semibold text-foreground">
                Category Distribution
              </CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              {activeCategories.length} active of {daily.categoryBreakdown.length} categories
            </span>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Distribution of daily work across tracked categories
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="flex justify-center py-2">
            <CategoryPieChart
              categories={daily.categoryBreakdown}
              totalMinutes={daily.workMinutes}
              size="md"
              centerTitle="Daily"
              ariaLabel="Daily category time distribution pie chart"
              testId="daily-category-pie-chart"
            />
          </div>

          <div className="grid gap-2">
            {daily.categoryBreakdown.map((category) => {
              const theme = getCategoryTheme(category.key);
              const isZero = category.minutes === 0;
              const pct =
                daily.workMinutes > 0
                  ? Math.round((category.minutes / daily.workMinutes) * 100)
                  : 0;

              return (
                <div
                  key={category.key}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                    !isZero && "hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 rounded-full shrink-0",
                        isZero ? "bg-muted-foreground/30" : theme.dotClass,
                      )}
                    />
                    <span
                      className={cn(
                        "truncate font-medium",
                        isZero ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {category.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={cn(
                        "font-mono tabular-nums",
                        isZero ? "text-muted-foreground/60" : "font-semibold text-foreground",
                      )}
                    >
                      {formatHuman(category.minutes)}
                    </span>
                    <span className="w-9 text-right font-mono text-muted-foreground tabular-nums">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Action Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/timeline?date=${daily.date}`}>
            <Clock aria-hidden className="size-3.5" />
            <span>Timeline</span>
            <ExternalLink aria-hidden className="size-3 text-muted-foreground" />
          </Link>
        </Button>

        <Button variant="outline" size="sm" asChild>
          <Link href={`/reports?date=${daily.date}`}>
            <span>Daily Review & Sync</span>
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
