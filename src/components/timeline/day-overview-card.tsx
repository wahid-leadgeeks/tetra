"use client";

import Link from "next/link";
import { LogOut, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryPieChart } from "@/components/ui/category-pie-chart";
import { formatClock } from "@/components/timeline/time";
import { getCategoryTheme } from "@/lib/categories";
import { formatHuman } from "@/lib/time";
import type { DaySummaryDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DayOverviewCardProps {
  summary: DaySummaryDTO | null;
  timeZone: string;
  dayKey: string;
  clockingOut: boolean;
  handleQuickClockOut: () => Promise<void>;
  setAttendanceDialogOpen: (open: boolean) => void;
}

export function DayOverviewCard({
  summary,
  timeZone,
  dayKey,
  clockingOut,
  handleQuickClockOut,
  setAttendanceDialogOpen,
}: DayOverviewCardProps) {
  return (
    <Card className="shadow-xs border-border/80" data-testid="timeline-summary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold">Day Overview</CardTitle>
          {summary && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {summary.timeEntries.length} {summary.timeEntries.length === 1 ? "task" : "tasks"}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-muted/30 p-3 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Work Time
            </span>
            <p className="font-heading text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {formatHuman(summary?.totals.workMinutes ?? 0)}
            </p>
          </div>

          <div className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-muted/30 p-3 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Break Time
            </span>
            <p className="font-heading text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {formatHuman(summary?.totals.breakMinutes ?? 0)}
            </p>
          </div>
        </div>

        {/* Attendance */}
        {summary?.attendance && !summary.attendance.clockOutAt ? (
          <div className="flex flex-col gap-2 p-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.04] shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-semibold text-foreground">Attendance</span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                {formatClock(summary.attendance.clockInAt, timeZone)} → Open
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 h-8 text-xs font-medium cursor-pointer"
                onClick={() => void handleQuickClockOut()}
                disabled={clockingOut}
                data-testid="timeline-clockout-button"
              >
                <LogOut className="size-3.5 mr-1" />
                {clockingOut ? "Closing…" : "Clock out"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs cursor-pointer"
                onClick={() => setAttendanceDialogOpen(true)}
                data-testid="timeline-edit-attendance"
              >
                <Pencil className="size-3 mr-1" />
                Edit
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs py-2 px-3 rounded-lg border border-border/60 bg-muted/20">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-muted-foreground">Attendance</span>
              {summary?.attendance && (
                <span className="size-1.5 rounded-full bg-emerald-500" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground tabular-nums">
                {summary?.attendance
                  ? `${formatClock(summary.attendance.clockInAt, timeZone)} → ${
                      summary.attendance.clockOutAt
                        ? formatClock(summary.attendance.clockOutAt, timeZone)
                        : "Open"
                    }`
                  : "No attendance"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setAttendanceDialogOpen(true)}
                title={summary?.attendance ? "Edit attendance" : "Set attendance"}
                aria-label="Manage attendance"
              >
                {summary?.attendance ? (
                  <Pencil className="size-3" />
                ) : (
                  <Plus className="size-3" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Day's Categories */}
        {summary && summary.byCategory.some((c) => c.minutes > 0) ? (
          <div className="flex flex-col gap-2.5 pt-2 border-t border-border/50">
            <span className="text-xs font-semibold text-foreground">Categories</span>
            <div className="flex justify-center py-2">
              <CategoryPieChart
                categories={summary.byCategory}
                totalMinutes={summary.totals.workMinutes}
                size="sm"
                centerTitle="Day Total"
                ariaLabel="Day category time distribution pie chart"
                testId="timeline-category-pie-chart"
              />
            </div>
            <div className="flex flex-col gap-1">
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
                      <div className="flex items-center gap-1.5 tabular-nums">
                        <span className="font-semibold text-foreground">
                          {formatHuman(category.minutes)}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : null}

        <Button asChild variant="outline" size="sm" className="w-full mt-1">
          <Link href={`/reports?date=${dayKey}`} className="gap-1.5 text-xs">
            Review this day
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
