import Link from "next/link";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

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
import type { MonthDay } from "@/features/monthly-summary/domain";
import type { MonthSummary } from "@/features/monthly-summary/service";

interface MonthlyViewProps {
  month: MonthSummary;
}

/** "September 2026" — friendly month label (UTC-noon, tz-safe). */
function formatMonthLabel(dayKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dayKey}T12:00:00Z`));
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

function DayRow({ day }: { day: MonthDay }) {
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
          data-testid={`month-day-${day.workDate}`}
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
 * Monthly Summary (DESIGN.md: calm, one primary accent, no chart clutter) —
 * pure presentational RSC mirroring the weekly view. All math already
 * happened server-side in getMonthSummary; navigation is Link-based so
 * nothing needs a client bundle.
 */
export function MonthlyView({ month }: MonthlyViewProps) {
  const prevAnchor = addDaysISO(month.from, -1);
  const nextAnchor = addDaysISO(month.to, 1);

  return (
    <div
      className="w-full"
      data-testid="month-view"
    >
      <header className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Monthly Summary
            </h1>
            <p className="text-muted-foreground">
              {formatMonthLabel(month.from)}
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
        <nav aria-label="Choose month" className="flex items-center gap-2">
          <Button asChild variant="outline" className="size-11 p-0">
            <Link
              href={`/reports/month?date=${prevAnchor}`}
              aria-label="Previous month"
              data-testid="month-prev"
            >
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          <p className="min-w-0 flex-1 text-center font-heading text-lg font-semibold" />
          <Button asChild variant="outline" className="size-11 p-0">
            <Link
              href={`/reports/month?date=${nextAnchor}`}
              aria-label="Next month"
              data-testid="month-next"
            >
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </nav>
      </header>

      <Separator className="my-6" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Totals + Category breakdown */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <Card data-testid="month-totals" className="shadow-xs border-border/80">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold">This month</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-4 shadow-xs">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Work Time
                  </p>
                  <p
                    className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums"
                    data-testid="month-total-work"
                  >
                    {formatHuman(month.totals.workMinutes)}
                  </p>
                  <span className="text-[11px] text-muted-foreground">Total logged</span>
                </div>

                <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-4 shadow-xs">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Break Time
                  </p>
                  <p
                    className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums"
                    data-testid="month-total-break"
                  >
                    {formatHuman(month.totals.breakMinutes)}
                  </p>
                  <span className="text-[11px] text-muted-foreground">Rest & pauses</span>
                </div>

                <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-4 shadow-xs">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Days Tracked
                  </p>
                  <p
                    className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums"
                    data-testid="month-total-days"
                  >
                    {month.totals.daysTracked}
                  </p>
                  <span className="text-[11px] text-muted-foreground">Active workdays</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-border/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>By category</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {month.byCategory.filter((c) => c.minutes > 0).length} active of 8 categories
                </span>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
            <div className="flex justify-center py-2">
              <CategoryPieChart
                categories={month.byCategory}
                totalMinutes={month.totals.workMinutes}
                size="md"
                centerTitle="Month Total"
                ariaLabel="Monthly category time distribution pie chart"
                testId="monthly-category-pie-chart"
              />
            </div>

              <div className="grid gap-2.5">
                {month.byCategory.map((category) => {
                  const theme = getCategoryTheme(category.key);
                  const isZero = category.minutes === 0;
                  const pct =
                    month.totals.workMinutes > 0
                      ? Math.round((category.minutes / month.totals.workMinutes) * 100)
                      : 0;

                  return (
                    <div
                      key={category.key}
                      className={cn(
                        "flex items-center justify-between gap-4 py-1.5 rounded-md px-2 transition-colors",
                        !isZero && "hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          aria-hidden
                          className={cn(
                            "size-2.5 rounded-full shrink-0 transition-opacity",
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
            <CardContent className="grid gap-2.5 max-h-[600px] overflow-y-auto pr-1">
              {month.days.map((day) => (
                <DayRow key={day.workDate} day={day} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
