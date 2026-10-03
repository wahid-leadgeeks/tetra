"use client";

import { useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutDashboard,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryPieChart } from "@/components/ui/category-pie-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDayLong } from "@/components/timeline/time";
import { DailyProgressSection } from "@/components/dashboard/daily-progress-section";
import { MonthlyProgressSection } from "@/components/dashboard/monthly-progress-section";
import { PersonalWeeklyReportTable } from "@/components/dashboard/personal-weekly-report-table";
import { ProgressKpiCard } from "@/components/dashboard/progress-kpi-card";
import { WeeklyProgressSection } from "@/components/dashboard/weekly-progress-section";
import { formatDiffHuman } from "@/features/dashboard/domain";
import type { DashboardDataDTO, MonthWeekSliceDTO } from "@/features/dashboard/types";
import { getCategoryTheme } from "@/lib/categories";
import { addDaysISO, formatHuman, todayKey } from "@/lib/time";
import { cn } from "@/lib/utils";

export type DashboardTab = "overview" | "daily" | "weekly" | "monthly";

export interface DashboardViewProps {
  initialData: DashboardDataDTO;
  initialTab?: DashboardTab;
}

export function DashboardView({
  initialData,
  initialTab = "overview",
}: DashboardViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const anchorDate = initialData.anchorDate;
  const timezone = initialData.timezone;
  const today = todayKey(timezone);
  const isToday = anchorDate === today;

  function navigateTo(newDate: string, tab: DashboardTab = activeTab) {
    startTransition(() => {
      router.push(`/dashboard?date=${newDate}&tab=${tab}`);
    });
  }

  function handleTabChange(value: string) {
    const nextTab = value as DashboardTab;
    setActiveTab(nextTab);
    startTransition(() => {
      router.push(`/dashboard?date=${anchorDate}&tab=${nextTab}`);
    });
  }

  function handlePrev() {
    if (activeTab === "weekly") {
      navigateTo(addDaysISO(anchorDate, -7));
    } else if (activeTab === "monthly") {
      // Step to the previous month
      navigateTo(addDaysISO(initialData.monthly.from, -1));
    } else {
      // Daily or Overview: step by 1 day
      navigateTo(addDaysISO(anchorDate, -1));
    }
  }

  function handleNext() {
    if (activeTab === "weekly") {
      navigateTo(addDaysISO(anchorDate, 7));
    } else if (activeTab === "monthly") {
      // Step to the next month
      navigateTo(addDaysISO(initialData.monthly.to, 1));
    } else {
      // Daily or Overview: step by 1 day
      navigateTo(addDaysISO(anchorDate, 1));
    }
  }

  function handleTodayJump() {
    navigateTo(today);
  }

  /** Opens the native date picker anchored under the period label. */
  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      // showPicker is unsupported or blocked: fall back to focusing the input.
      input.focus();
      input.click();
    }
  }

  // Compute descriptive period label for active tab
  let periodLabel = formatDayLong(anchorDate);
  if (activeTab === "weekly") {
    periodLabel = `Week ${initialData.weekly.weekNumber} · ${initialData.weekly.dateRangeLabel}`;
  } else if (activeTab === "monthly") {
    periodLabel = initialData.monthly.monthLabel;
  }

  const activeMonthlyCategories = initialData.monthly.categoryBreakdown.filter(
    (c) => c.minutes > 0,
  );

  return (
    <div className="grid gap-6">
      {/* Top Header & Period Stepper */}
      <header className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Daily, weekly, and monthly time tracking progress and target achievements
            </p>
          </div>

          {/* Quick action: Today reset */}
          {!isToday && (
            <Button
              variant="outline"
              size="sm"
              data-testid="dashboard-today-btn"
              onClick={handleTodayJump}
              disabled={isPending}
              className="gap-1.5 self-start text-xs sm:self-auto"
            >
              <RotateCcw aria-hidden className="size-3.5" />
              <span>Today</span>
            </Button>
          )}
        </div>

        {/* Period Navigation Bar */}
        <nav
          aria-label="Period navigation"
          className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-card p-2 shadow-xs"
        >
          <Button
            variant="outline"
            size="icon-sm"
            data-testid="dashboard-prev-btn"
            onClick={handlePrev}
            disabled={isPending}
            aria-label="Previous period"
            className="size-9 rounded-lg"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Button>

          <div className="relative flex min-w-0 flex-1 justify-center">
            <button
              type="button"
              data-testid="dashboard-period-label"
              onClick={openDatePicker}
              disabled={isPending}
              aria-label={`${periodLabel}. Jump to a specific date`}
              className="min-w-0 max-w-full truncate rounded-md px-2 py-1 text-center font-heading text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-base"
            >
              {periodLabel}
            </button>
            {/* Native picker opened from the label; not focusable or visible on its own */}
            <input
              ref={dateInputRef}
              type="date"
              tabIndex={-1}
              aria-hidden
              data-testid="dashboard-period-date-input"
              value={anchorDate}
              onChange={(e) => {
                if (e.target.value) {
                  navigateTo(e.target.value);
                }
              }}
              className="pointer-events-none absolute inset-x-0 bottom-0 h-0 w-full opacity-0"
            />
          </div>

          <Button
            variant="outline"
            size="icon-sm"
            data-testid="dashboard-next-btn"
            onClick={handleNext}
            disabled={isPending}
            aria-label="Next period"
            className="size-9 rounded-lg"
          >
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </nav>
      </header>

      {/* Main Tabs Container */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="grid gap-6"
        data-testid="dashboard-tabs"
      >
        <TabsList
          data-testid="dashboard-tabs"
          className="grid w-full grid-cols-4 sm:w-auto sm:inline-grid p-1"
        >
          <TabsTrigger
            value="overview"
            data-testid="tab-overview"
            className="gap-1.5 text-xs sm:text-sm"
          >
            <LayoutDashboard aria-hidden className="size-3.5" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger
            value="daily"
            data-testid="tab-daily"
            className="gap-1.5 text-xs sm:text-sm"
          >
            <Clock aria-hidden className="size-3.5" />
            <span>Daily</span>
          </TabsTrigger>
          <TabsTrigger
            value="weekly"
            data-testid="tab-weekly"
            className="gap-1.5 text-xs sm:text-sm"
          >
            <BarChart3 aria-hidden className="size-3.5" />
            <span>Weekly</span>
          </TabsTrigger>
          <TabsTrigger
            value="monthly"
            data-testid="tab-monthly"
            className="gap-1.5 text-xs sm:text-sm"
          >
            <CalendarDays aria-hidden className="size-3.5" />
            <span>Monthly</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab Content */}
        <TabsContent value="overview" className="grid gap-6">
          {/* 3 KPI Cards Row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Daily KPI */}
            <ProgressKpiCard
              testId="overview-daily-kpi"
              title={`${initialData.daily.dayOfWeek} Work`}
              workMinutes={initialData.daily.workMinutes}
              targetMinutes={initialData.daily.targetMinutes}
              diff={formatDiffHuman(initialData.daily.diffMinutes)}
              diffLabel="vs 8h target"
              weekend={initialData.daily.isWeekend}
              progressPct={initialData.daily.progressPct}
              attendanceMinutes={initialData.daily.attendanceMinutes}
              breakMinutes={initialData.daily.breakMinutes}
              icon={Clock}
              subtext={`${initialData.daily.workDate} (Click for Daily)`}
              onClick={() => handleTabChange("daily")}
            />

            {/* Weekly KPI */}
            <ProgressKpiCard
              testId="overview-weekly-kpi"
              title={`Week ${initialData.weekly.weekNumber} Work`}
              workMinutes={initialData.weekly.workMinutes}
              targetMinutes={initialData.weekly.targetMinutes}
              diff={initialData.weekly.diff}
              expectedMinutes={initialData.weekly.expectedMinutes}
              expectedDiff={initialData.weekly.expectedDiff}
              progressPct={initialData.weekly.progressPct}
              daysTracked={initialData.weekly.daysTracked}
              workdaysCount={initialData.weekly.workdaysCount}
              breakMinutes={initialData.weekly.breakMinutes}
              icon={BarChart3}
              subtext={`${initialData.weekly.dateRangeLabel} (Click for Weekly)`}
              onClick={() => handleTabChange("weekly")}
            />

            {/* Monthly KPI */}
            <ProgressKpiCard
              testId="overview-monthly-kpi"
              title={initialData.monthly.monthLabel}
              workMinutes={initialData.monthly.workMinutes}
              targetMinutes={initialData.monthly.targetMinutes}
              diff={initialData.monthly.diff}
              expectedMinutes={initialData.monthly.expectedMinutes}
              expectedDiff={initialData.monthly.expectedDiff}
              progressPct={initialData.monthly.progressPct}
              daysTracked={initialData.monthly.daysTracked}
              workdaysCount={initialData.monthly.totalWorkdays}
              breakMinutes={initialData.monthly.breakMinutes}
              icon={CalendarDays}
              subtext={`${initialData.monthly.totalWorkdays} workdays (Click for Monthly)`}
              onClick={() => handleTabChange("monthly")}
            />
          </div>

          {/* Faithful Personal Weekly Report Table from Google Sheet */}
          <PersonalWeeklyReportTable
            monthly={initialData.monthly}
            onSelectWeek={(slice: MonthWeekSliceDTO) => {
              navigateTo(slice.from, "weekly");
            }}
          />

          {/* Cumulative Monthly Category Snapshot */}
          <Card className="border-border/80 bg-card shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles aria-hidden className="size-4 text-primary" />
                  <CardTitle className="font-heading text-sm font-semibold text-foreground">
                    Monthly Category Time Allocation
                  </CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">
                  {activeMonthlyCategories.length} active • {initialData.monthly.monthLabel}
                </span>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Distribution across categories for the entire month
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              <div className="flex justify-center py-2">
                <CategoryPieChart
                  categories={initialData.monthly.categoryBreakdown}
                  totalMinutes={initialData.monthly.workMinutes}
                  size="md"
                  centerTitle="Monthly"
                  ariaLabel="Monthly category distribution snapshot pie chart"
                  testId="dashboard-monthly-category-pie-chart"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {initialData.monthly.categoryBreakdown.map((category) => {
                  const theme = getCategoryTheme(category.key);
                  const isZero = category.minutes === 0;
                  const pct =
                    initialData.monthly.workMinutes > 0
                      ? Math.round(
                          (category.minutes / initialData.monthly.workMinutes) * 100,
                        )
                      : 0;

                  return (
                    <div
                      key={category.key}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border border-border/50 p-2 text-xs",
                        !isZero ? "bg-muted/20" : "opacity-60",
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          aria-hidden
                          className={cn("size-2 rounded-full shrink-0", theme.dotClass)}
                        />
                        <span className="truncate font-medium text-foreground">
                          {theme.shortName || category.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {pct > 0 && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {pct}%
                          </span>
                        )}
                        <span className="font-mono font-semibold tabular-nums text-foreground">
                          {formatHuman(category.minutes)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Tab Content */}
        <TabsContent value="daily">
          <DailyProgressSection
            daily={initialData.daily}
            timezone={timezone}
          />
        </TabsContent>

        {/* Weekly Tab Content */}
        <TabsContent value="weekly">
          <WeeklyProgressSection
            weekly={initialData.weekly}
            onSelectDay={(dayKey) => {
              navigateTo(dayKey, "daily");
            }}
          />
        </TabsContent>

        {/* Monthly Tab Content */}
        <TabsContent value="monthly">
          <MonthlyProgressSection
            monthly={initialData.monthly}
            onSelectWeek={(slice: MonthWeekSliceDTO) => {
              navigateTo(slice.from, "weekly");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
