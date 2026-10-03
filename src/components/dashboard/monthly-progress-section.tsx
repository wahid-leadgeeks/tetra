"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PersonalWeeklyReportTable } from "@/components/dashboard/personal-weekly-report-table";
import { ProgressKpiCard } from "@/components/dashboard/progress-kpi-card";
import type { MonthWeekSliceDTO, MonthlyProgressDTO } from "@/features/dashboard/types";
import { formatHuman } from "@/lib/time";

export interface MonthlyProgressSectionProps {
  monthly: MonthlyProgressDTO;
  onSelectWeek?: (slice: MonthWeekSliceDTO) => void;
}

export function MonthlyProgressSection({
  monthly,
  onSelectWeek,
}: MonthlyProgressSectionProps) {
  return (
    <div data-testid="monthly-progress-section" className="grid gap-6">
      {/* Monthly KPI Card */}
      <ProgressKpiCard
        testId="monthly-kpi"
        title={`${monthly.monthLabel} Progress`}
        workMinutes={monthly.workMinutes}
        targetMinutes={monthly.targetMinutes}
        diff={monthly.diff}
        expectedMinutes={monthly.expectedMinutes}
        expectedDiff={monthly.expectedDiff}
        progressPct={monthly.progressPct}
        daysTracked={monthly.daysTracked}
        workdaysCount={monthly.totalWorkdays}
        breakMinutes={monthly.breakMinutes}
        icon={CalendarDays}
        subtext={`${monthly.monthLabel} (${monthly.totalWorkdays} workdays × 8h = ${formatHuman(monthly.targetMinutes)})`}
      />

      {/* Faithful Personal Weekly Report Table from Google Sheet */}
      <PersonalWeeklyReportTable monthly={monthly} onSelectWeek={onSelectWeek} />

      {/* Monthly Report link: category breakdown lives in /reports/month */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-0.5">
            <p className="font-heading text-sm font-semibold text-foreground">Monthly Report</p>
            <p className="text-xs text-muted-foreground">
              Category breakdown and per-day totals for {monthly.monthLabel}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/reports/month?date=${monthly.from}`} data-testid="dashboard-open-month-report-link">
              <span>Open Monthly Report</span>
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
