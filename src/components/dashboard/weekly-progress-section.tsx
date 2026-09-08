"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressKpiCard } from "@/components/dashboard/progress-kpi-card";
import type { WeekDayProgressDTO, WeeklyProgressDTO } from "@/features/dashboard/types";
import { getCategoryTheme } from "@/lib/categories";
import { formatHuman } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface WeeklyProgressSectionProps {
  weekly: WeeklyProgressDTO;
  onSelectDay?: (dayKey: string) => void;
}

function getDayStatusBadge(day: WeekDayProgressDTO) {
  if (!day.isWorkday && day.workMinutes === 0) {
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
  const activeCategories = weekly.categoryBreakdown.filter((c) => c.minutes > 0);

  return (
    <div data-testid="weekly-progress-section" className="grid gap-6">
      {/* Weekly KPI Overview */}
      <ProgressKpiCard
        testId="weekly-kpi"
        title={`Week ${weekly.weekNumber} Progress`}
        workMinutes={weekly.workMinutes}
        targetMinutes={weekly.targetMinutes}
        diff={weekly.diff}
        progressPct={weekly.progressPct}
        daysTracked={weekly.daysTracked}
        workdaysCount={weekly.workdaysCount}
        breakMinutes={weekly.breakMinutes}
        icon={BarChart3}
        subtext={`${weekly.dateRangeLabel} (${weekly.workdaysCount} workdays × 8:00)`}
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
                  <div className="flex items-baseline justify-between gap-1 py-1">
                    <span className="font-mono text-base font-bold text-foreground tabular-nums">
                      {formatHuman(day.workMinutes)}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      / {day.isWorkday ? "8h" : "0h"}
                    </span>
                  </div>

                  {/* Diff badge */}
                  {day.isWorkday && (
                    <div className="pt-1">
                      <Badge
                        variant={day.diff.isExact ? "outline" : "default"}
                        className={cn(
                          "font-mono text-[10px] font-semibold tabular-nums px-1.5 py-0",
                          day.diff.isAhead &&
                            "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                          day.diff.isBehind &&
                            "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                          day.diff.isExact && "border-border/60 bg-muted/40 text-muted-foreground",
                        )}
                      >
                        {day.diff.formatted}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="pt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted shadow-inner">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        day.diff.isAhead || day.progressPct >= 100
                          ? "bg-emerald-500"
                          : "bg-primary",
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
              </Card>
            );
          })}
        </div>
      </div>

      {/* Weekly Category Distribution */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden className="size-4 text-primary" />
              <CardTitle className="font-heading text-sm font-semibold text-foreground">
                Weekly Category Distribution
              </CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              {activeCategories.length} active of {weekly.categoryBreakdown.length} categories
            </span>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Time allocated across categories for Week {weekly.weekNumber}
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4">
          {weekly.workMinutes > 0 && (
            <div
              aria-label="Weekly category time distribution"
              className="flex h-3 w-full overflow-hidden rounded-full bg-muted/70 shadow-inner"
            >
              {activeCategories.map((category) => {
                const theme = getCategoryTheme(category.key);
                const pct = Math.max(2, (category.minutes / weekly.workMinutes) * 100);
                return (
                  <div
                    key={category.key}
                    title={`${category.name}: ${formatHuman(category.minutes)} (${Math.round((category.minutes / weekly.workMinutes) * 100)}%)`}
                    style={{ width: `${pct}%` }}
                    className={cn("h-full transition-all duration-300", theme.barColor)}
                  />
                );
              })}
            </div>
          )}

          <div className="grid gap-2">
            {weekly.categoryBreakdown.map((category) => {
              const theme = getCategoryTheme(category.key);
              const isZero = category.minutes === 0;
              const pct =
                weekly.workMinutes > 0
                  ? Math.round((category.minutes / weekly.workMinutes) * 100)
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

      {/* Action link */}
      <div className="flex justify-end pt-1">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/reports/week?date=${weekly.from}`}>
            <span>Open Full Weekly Report</span>
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
