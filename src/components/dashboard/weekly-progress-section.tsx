"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Calendar } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressKpiCard } from "@/components/dashboard/progress-kpi-card";
import { formatDiffHuman } from "@/features/dashboard/domain";
import type { WeekDayProgressDTO, WeeklyProgressDTO } from "@/features/dashboard/types";
import { formatHuman } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface WeeklyProgressSectionProps {
  weekly: WeeklyProgressDTO;
  onSelectDay?: (dayKey: string) => void;
}

function getDayStatusBadge(day: WeekDayProgressDTO) {
  if (!day.isWorkday) {
    // A weekend with no work renders "Weekend" in the card body instead.
    if (day.workMinutes === 0) return null;
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/60">
        Weekend
      </Badge>
    );
  }

  if (day.status === "completed" || day.workMinutes >= day.targetMinutes) {
    return (
      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">
        Done
      </Badge>
    );
  }

  if (day.status === "in_progress") {
    return (
      <Badge className="border-primary/30 bg-primary/10 text-primary text-[10px] font-semibold">
        In Progress
      </Badge>
    );
  }

  if (day.isFuture || (day.isToday && !day.hasData)) return null;

  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      {day.hasData ? "Partial" : "Off"}
    </Badge>
  );
}

export function WeeklyProgressSection({
  weekly,
  onSelectDay,
}: WeeklyProgressSectionProps) {
  return (
    <div data-testid="weekly-progress-section" className="grid gap-6">
      {/* Weekly KPI Overview */}
      <ProgressKpiCard
        testId="weekly-kpi"
        title={`Week ${weekly.weekNumber} Progress`}
        workMinutes={weekly.workMinutes}
        targetMinutes={weekly.targetMinutes}
        diff={weekly.diff}
        expectedMinutes={weekly.expectedMinutes}
        expectedDiff={weekly.expectedDiff}
        progressPct={weekly.progressPct}
        daysTracked={weekly.daysTracked}
        workdaysCount={weekly.workdaysCount}
        breakMinutes={weekly.breakMinutes}
        icon={BarChart3}
        subtext={`${weekly.dateRangeLabel} (${weekly.workdaysCount} workdays × 8h)`}
      />

      {/* 7-Day Card Grid */}
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar aria-hidden className="size-4 text-primary" />
            <h3 className="font-heading text-sm font-semibold text-foreground">
              Day-by-Day Distribution (Monday – Sunday)
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {weekly.daysTracked} of {weekly.workdaysCount} workdays tracked
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-7">
          {weekly.days.map((day) => {
            const isClickable = Boolean(onSelectDay);
            const isWeekendOff = !day.isWorkday && day.workMinutes === 0;
            // Past workdays compare to their expected 8h; today compares to its 8h target.
            const dayDiff = day.isToday ? formatDiffHuman(day.diffMinutes) : day.expectedDiff;

            return (
              <Card
                key={day.workDate}
                data-testid={`weekday-card-${day.workDate}`}
                onClick={() => onSelectDay?.(day.workDate)}
                className={cn(
                  "relative flex flex-col justify-between overflow-hidden border-border/70 p-3.5 shadow-xs transition-all",
                  day.isAnchorDate && "border-primary/70 ring-1 ring-primary/40 bg-primary/5",
                  isClickable &&
                    "cursor-pointer hover:border-border hover:shadow-xs active:scale-[0.98]",
                )}
              >
                <div>
                  {/* Top row: Day name + status */}
                  <div className="flex items-center justify-between gap-1.5 pb-2">
                    <div className="flex items-baseline gap-1">
                      <span className="font-heading text-xs font-bold text-foreground">
                        {day.dayName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {day.workDate.slice(5)}
                      </span>
                    </div>

                    {getDayStatusBadge(day)}
                  </div>

                  {/* Logged time vs target */}
                  {isWeekendOff ? (
                    <p className="py-1 font-heading text-base font-semibold text-muted-foreground">
                      Weekend
                    </p>
                  ) : (
                    <div className="flex items-baseline justify-between gap-1 py-1">
                      <span className="font-mono text-base font-bold text-foreground tabular-nums">
                        {formatHuman(day.workMinutes)}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {day.isWorkday ? "/ 8h" : "no target"}
                      </span>
                    </div>
                  )}

                  {/* Diff badge (vs expected; future days have nothing to compare yet) */}
                  {day.isWorkday && (
                    <div className="pt-1">
                      {day.isFuture ? (
                        <span className="font-mono text-[10px] text-muted-foreground">—</span>
                      ) : (
                        <Badge
                          variant={dayDiff.isExact ? "outline" : "default"}
                          className={cn(
                            "font-mono text-[10px] font-semibold tabular-nums px-1.5 py-0",
                            dayDiff.isAhead &&
                              "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                            dayDiff.isBehind &&
                              "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                            dayDiff.isExact && "border-border/60 bg-muted/40 text-muted-foreground",
                          )}
                        >
                          {dayDiff.formatted}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {day.isWorkday && (
                  <div className="pt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted shadow-inner">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          day.progressPct >= 100 ? "bg-emerald-500" : "bg-primary",
                        )}
                        style={{
                          width: `${Math.min(100, Math.max(0, day.progressPct))}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground tabular-nums">
                      <span>{day.progressPct}%</span>
                      {day.isAnchorDate && (
                        <span className="font-semibold text-primary">Active</span>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Weekly Report link: category breakdown lives in /reports/week */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-0.5">
            <p className="font-heading text-sm font-semibold text-foreground">Weekly Report</p>
            <p className="text-xs text-muted-foreground">
              Category breakdown and per-day totals
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/reports/week?date=${weekly.from}`} data-testid="dashboard-open-week-report-link">
              <span>Open Weekly Report</span>
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
