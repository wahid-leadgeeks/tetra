"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryPieChart } from "@/components/ui/category-pie-chart";
import { PersonalWeeklyReportTable } from "@/components/dashboard/personal-weekly-report-table";
import { ProgressKpiCard } from "@/components/dashboard/progress-kpi-card";
import type { MonthWeekSliceDTO, MonthlyProgressDTO } from "@/features/dashboard/types";
import { getCategoryTheme } from "@/lib/categories";
import { formatHuman } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface MonthlyProgressSectionProps {
  monthly: MonthlyProgressDTO;
  onSelectWeek?: (slice: MonthWeekSliceDTO) => void;
}

export function MonthlyProgressSection({
  monthly,
  onSelectWeek,
}: MonthlyProgressSectionProps) {
  const activeCategories = monthly.categoryBreakdown.filter((c) => c.minutes > 0);

  return (
    <div data-testid="monthly-progress-section" className="grid gap-6">
      {/* Monthly KPI Card */}
      <ProgressKpiCard
        testId="monthly-kpi"
        title={`${monthly.monthLabel} Progress`}
        workMinutes={monthly.workMinutes}
        targetMinutes={monthly.targetMinutes}
        diff={monthly.diff}
        progressPct={monthly.progressPct}
        daysTracked={monthly.daysTracked}
        workdaysCount={monthly.totalWorkdays}
        breakMinutes={monthly.breakMinutes}
        icon={CalendarDays}
        subtext={`${monthly.monthLabel} (${monthly.totalWorkdays} workdays × 8:00 = ${monthly.formattedTotalTarget})`}
      />

      {/* Faithful Personal Weekly Report Table from Google Sheet */}
      <PersonalWeeklyReportTable monthly={monthly} onSelectWeek={onSelectWeek} />

      {/* Monthly Category Distribution */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden className="size-4 text-primary" />
              <CardTitle className="font-heading text-sm font-semibold text-foreground">
                Monthly Category Distribution
              </CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              {activeCategories.length} active of {monthly.categoryBreakdown.length} categories
            </span>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Cumulative time distribution across categories for {monthly.monthLabel}
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="flex justify-center py-2">
            <CategoryPieChart
              categories={monthly.categoryBreakdown}
              totalMinutes={monthly.workMinutes}
              size="md"
              centerTitle="Monthly"
              ariaLabel="Monthly category time distribution pie chart"
              testId="monthly-category-pie-chart"
            />
          </div>

          <div className="grid gap-2">
            {monthly.categoryBreakdown.map((category) => {
              const theme = getCategoryTheme(category.key);
              const isZero = category.minutes === 0;
              const pct =
                monthly.workMinutes > 0
                  ? Math.round((category.minutes / monthly.workMinutes) * 100)
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
          <Link href={`/reports/month?date=${monthly.from}`}>
            <span>Open Full Monthly Report</span>
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
