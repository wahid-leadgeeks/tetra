"use client";

import { Clock, Coffee } from "lucide-react";

import { CategoryPieChart } from "@/components/ui/category-pie-chart";
import { TargetProgress } from "@/components/today/target-progress";
import { getCategoryTheme } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { formatHuman, zonedClock } from "@/lib/time";
import type { AttendanceDTO, DaySummaryDTO, TimeEntryDTO } from "@/lib/types";

interface TodayOverviewPanelProps {
  summary: DaySummaryDTO | null;
  attendance: AttendanceDTO | null;
  activeEntry: TimeEntryDTO | null;
  timezone: string;
  initialNowMs: number;
}

export function TodayOverviewPanel({
  summary,
  attendance,
  activeEntry,
  timezone,
  initialNowMs,
}: TodayOverviewPanelProps) {
  return (
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

          <div className="flex justify-center py-2">
            <CategoryPieChart
              categories={summary.byCategory}
              totalMinutes={summary.totals.workMinutes}
              size="md"
              centerTitle="Today"
              ariaLabel="Today category distribution pie chart"
              testId="today-category-pie-chart"
            />
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
  );
}
