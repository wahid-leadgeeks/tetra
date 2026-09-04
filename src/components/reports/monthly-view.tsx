import Link from "next/link";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { addDaysISO, formatHuman } from "@/lib/time";
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
      className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6"
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

      <div className="grid gap-6">
        <Card data-testid="month-totals">
          <CardHeader>
            <CardTitle>This month</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-muted-foreground">Work</p>
              <p
                className="font-heading font-semibold tabular-nums"
                data-testid="month-total-work"
              >
                {formatHuman(month.totals.workMinutes)}
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-muted-foreground">Break</p>
              <p
                className="font-heading font-semibold tabular-nums"
                data-testid="month-total-break"
              >
                {formatHuman(month.totals.breakMinutes)}
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-muted-foreground">Days tracked</p>
              <p
                className="font-heading font-semibold tabular-nums"
                data-testid="month-total-days"
              >
                {month.totals.daysTracked}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {month.byCategory.map((category) => (
              <div
                key={category.key}
                className="flex items-baseline justify-between gap-4"
              >
                <p
                  className={
                    category.minutes === 0
                      ? "text-muted-foreground/60"
                      : "text-foreground"
                  }
                >
                  {category.name}
                </p>
                <p
                  className={`font-heading font-medium tabular-nums ${
                    category.minutes === 0
                      ? "text-muted-foreground/60"
                      : "font-semibold"
                  }`}
                >
                  {formatHuman(category.minutes)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By day</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {month.days.map((day) => (
              <DayRow key={day.workDate} day={day} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
