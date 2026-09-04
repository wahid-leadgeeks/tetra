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

  return (
    <div
      className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6"
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
        </nav>
      </header>

      <Separator className="my-6" />

      <div className="grid gap-6">
        <Card data-testid="week-totals">
          <CardHeader>
            <CardTitle>This week</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-muted-foreground">Work</p>
              <p
                className="font-heading font-semibold tabular-nums"
                data-testid="week-total-work"
              >
                {formatHuman(week.totals.workMinutes)}
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-muted-foreground">Break</p>
              <p
                className="font-heading font-semibold tabular-nums"
                data-testid="week-total-break"
              >
                {formatHuman(week.totals.breakMinutes)}
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-muted-foreground">Days tracked</p>
              <p
                className="font-heading font-semibold tabular-nums"
                data-testid="week-total-days"
              >
                {week.totals.daysTracked}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {week.byCategory.map((category) => (
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
            {week.days.map((day) => (
              <DayRow key={day.workDate} day={day} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
