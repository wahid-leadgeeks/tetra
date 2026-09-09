import Link from "next/link";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CategoryPieChart } from "@/components/ui/category-pie-chart";
import { Separator } from "@/components/ui/separator";
import { getCategoryTheme } from "@/lib/categories";
import { addDaysISO, formatHuman } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { WeekDay } from "@/features/weekly-summary/domain";
import type { WeekSummary } from "@/features/weekly-summary/service";

interface WeeklyViewProps {
  week: WeekSummary;
}

/** "Aug 31 – Sep 6, 2026" — friendly range label (UTC-noon, tz-safe). */
function formatRangeLabel(from: string, to: string): string {
  const fmt = (dayKey: string, withYear: boolean) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    }).format(new Date(`${dayKey}T12:00:00Z`));
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${fmt(from, !sameYear)} – ${fmt(to, true)}`;
}

/** "Wed, Sep 2" — short day label for the per-day list. */
function formatDayShortWeekday(dayKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dayKey}T12:00:00Z`));
}

function DayRow({ day }: { day: WeekDay }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <p
        className={
          day.hasData ? "text-foreground" : "text-muted-foreground/60"
        }
      >
        {formatDayShortWeekday(day.workDate)}
      </p>
      <div className="flex items-baseline gap-4">
        <p
          className={`text-sm tabular-nums ${
            day.hasData ? "text-muted-foreground" : "text-muted-foreground/60"
          }`}
          aria-label={`Break ${formatHuman(day.breakMinutes)}`}
        >
          {day.hasData ? `Break ${formatHuman(day.breakMinutes)}` : ""}
        </p>
        <p
          className={`font-heading font-medium tabular-nums ${
            day.hasData ? "font-semibold" : "text-muted-foreground/60"
          }`}
          data-testid={`week-day-${day.workDate}`}
        >
          {day.hasData
            ? `Work ${formatHuman(day.workMinutes)}`
            : "No data"}
        </p>
      </div>
    </div>
  );
}

/**
 * Weekly Summary (DESIGN.md: calm, one primary accent, no chart clutter) —
 * pure presentational RSC. All math already happened server-side in
 * getWeekSummary; navigation is Link-based so nothing needs a client bundle.
 */
export function WeeklyView({ week }: WeeklyViewProps) {
  const prevAnchor = addDaysISO(week.from, -1);
  const nextAnchor = addDaysISO(week.to, 1);
  const monthAnchor = week.days[Math.floor(week.days.length / 2)]?.workDate ?? week.from;

  return (
    <div
      className="w-full"
      data-testid="week-view"
    >
      <header className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Weekly Summary
            </h1>
            <p className="text-muted-foreground">
              {formatRangeLabel(week.from, week.to)}
            </p>
          </div>
          <Button asChild variant="outline" className="h-11 px-4">
            <Link
              href={`/reports`}
              aria-label="Back to daily review"
              className="gap-2"
            >
              <CalendarRange aria-hidden />
              Daily
            </Link>
          </Button>
        </div>
        <nav aria-label="Choose week" className="flex items-center gap-2">
          <Button asChild variant="outline" className="size-11 p-0">
            <Link
              href={`/reports/week?date=${prevAnchor}`}
              aria-label="Previous week"
              data-testid="week-prev"
            >
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          <p className="min-w-0 flex-1 text-center font-heading text-lg font-semibold" />
          <Button asChild variant="outline" className="size-11 p-0">
            <Link
              href={`/reports/week?date=${nextAnchor}`}
              aria-label="Next week"
              data-testid="week-next"
            >
              <ChevronRight aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 px-4">
            <Link
              href={`/reports/month?date=${monthAnchor}`}
              aria-label="Monthly summary"
              data-testid="month-link"
              className="gap-2"
            >
              <CalendarDays aria-hidden />
              Month
            </Link>
          </Button>
        </nav>
      </header>

      <Separator className="my-6" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Totals + Category breakdown */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <Card data-testid="week-totals" className="shadow-xs border-border/80">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold">This week</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-4 shadow-xs">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Work Time
                  </p>
                  <p
                    className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums"
                    data-testid="week-total-work"
                  >
                    {formatHuman(week.totals.workMinutes)}
                  </p>
                  <span className="text-[11px] text-muted-foreground">Total logged</span>
                </div>

                <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-4 shadow-xs">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Break Time
                  </p>
                  <p
                    className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums"
                    data-testid="week-total-break"
                  >
                    {formatHuman(week.totals.breakMinutes)}
                  </p>
                  <span className="text-[11px] text-muted-foreground">Rest & pauses</span>
                </div>

                <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-4 shadow-xs">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Days Tracked
                  </p>
                  <p
                    className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums"
                    data-testid="week-total-days"
                  >
                    {week.totals.daysTracked}
                  </p>
                  <span className="text-[11px] text-muted-foreground">Active workdays</span>
                </div>
              </div>
            </CardContent>
          </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>By category</CardTitle>
              <span className="text-xs text-muted-foreground">
                {week.byCategory.filter((c) => c.minutes > 0).length} active of 8 categories
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex justify-center py-2">
              <CategoryPieChart
                categories={week.byCategory}
                totalMinutes={week.totals.workMinutes}
                size="md"
                centerTitle="Week Total"
                ariaLabel="Weekly category time distribution pie chart"
                testId="weekly-category-pie-chart"
              />
            </div>

            <div className="grid gap-2.5">
              {week.byCategory.map((category) => {
                const theme = getCategoryTheme(category.key);
                const isZero = category.minutes === 0;
                const pct =
                  week.totals.workMinutes > 0
                    ? Math.round((category.minutes / week.totals.workMinutes) * 100)
                    : 0;

                return (
                  <div
                    key={category.key}
                    className={cn(
                      "flex items-center justify-between gap-4 py-1 rounded-md px-1.5 transition-colors",
                      !isZero && "hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        aria-hidden
                        className={cn(
                          "size-2 rounded-full shrink-0 transition-opacity",
                          theme.dotClass,
                          isZero && "opacity-30",
                        )}
                      />
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          isZero ? "text-muted-foreground/50" : "text-foreground",
                        )}
                      >
                        {category.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {!isZero && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {pct}%
                        </span>
                      )}
                      <p
                        className={cn(
                          "font-heading tabular-nums text-sm",
                          isZero
                            ? "text-muted-foreground/50"
                            : "font-semibold text-foreground",
                        )}
                      >
                        {formatHuman(category.minutes)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: By Day list */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <Card className="shadow-xs border-border/80">
          <CardHeader>
            <CardTitle>By day</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {week.days.map((day) => (
              <DayRow key={day.workDate} day={day} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
);
}
