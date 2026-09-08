"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Calendar,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDayLong } from "@/components/timeline/time";
import { DailyProgressSection } from "@/components/dashboard/daily-progress-section";
import { MonthlyProgressSection } from "@/components/dashboard/monthly-progress-section";
import { PersonalWeeklyReportTable } from "@/components/dashboard/personal-weekly-report-table";
import { ProgressKpiCard } from "@/components/dashboard/progress-kpi-card";
import { WeeklyProgressSection } from "@/components/dashboard/weekly-progress-section";
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

          {/* Quick actions: Today reset & Date jump picker */}
          <div className="flex items-center gap-2">
            {!isToday && (
              <Button
                variant="outline"
                size="sm"
                data-testid="dashboard-today-btn"
                onClick={handleTodayJump}
                disabled={isPending}
                className="gap-1.5 text-xs"
              >
                <RotateCcw aria-hidden className="size-3.5" />
                <span>Today</span>
              </Button>
            )}

            <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-background px-2 py-1 shadow-2xs">
              <Calendar aria-hidden className="size-3.5 text-muted-foreground" />
              <input
                type="date"
                data-testid="dashboard-date-picker"
                value={anchorDate}
                onChange={(e) => {
                  if (e.target.value) {
                    navigateTo(e.target.value);
                  }
                }}
                className="bg-transparent font-mono text-xs text-foreground outline-none cursor-pointer"
                aria-label="Jump to specific date"
              />
            </div>
          </div>
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

          <p
            data-testid="dashboard-period-label"
            className="min-w-0 flex-1 truncate text-center font-heading text-sm sm:text-base font-semibold text-foreground"
          >
            {periodLabel}
          </p>

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
              diff={initialData.daily.diff}
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
                  {initialData.monthly.monthLabel}
                </span>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Distribution across categories for the entire month
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              {initialData.monthly.workMinutes > 0 && (
                <div
                  aria-label="Monthly category distribution snapshot"
                  className="flex h-3 w-full overflow-hidden rounded-full bg-muted/70 shadow-inner"
                >
                  {activeMonthlyCategories.map((category) => {
                    const theme = getCategoryTheme(category.key);
                    const pct = Math.max(
                      2,
                      (category.minutes / initialData.monthly.workMinutes) * 100,
                    );
                    return (
                      <div
                        key={category.key}
                        title={`${category.name}: ${formatHuman(category.minutes)} (${Math.round((category.minutes / initialData.monthly.workMinutes) * 100)}%)`}
                        style={{ width: `${pct}%` }}
                        className={cn("h-full transition-all duration-300", theme.barColor)}
                      />
                    );
                  })}
                </div>
              )}

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
