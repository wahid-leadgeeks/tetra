"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatDayLong,
  isToday,
  nextDay,
  nextWorkday,
  previousDay,
  previousWorkday,
} from "@/components/timeline/time";
import { todayKey } from "@/lib/time";

interface DayNavigatorProps {
  dayKey: string;
  timeZone: string;
  onChange: (dayKey: string) => void;
  /** When true (default), skips Saturday and Sunday (days off). */
  excludeWeekends?: boolean;
}

/**
 * ‹ prev / date / next › navigator. Future days and weekends are blocked/skipped —
 * TETRA records work as it happens on working days.
 */
export function DayNavigator({
  dayKey,
  timeZone,
  onChange,
  excludeWeekends = true,
}: DayNavigatorProps) {
  const today = todayKey(timeZone);
  const prevTarget = excludeWeekends ? previousWorkday(dayKey) : previousDay(dayKey);
  const nextTarget = excludeWeekends ? nextWorkday(dayKey) : nextDay(dayKey);
  const cannotNavigateNext = excludeWeekends
    ? nextWorkday(dayKey) > today
    : isToday(dayKey, timeZone) || dayKey >= today;

  return (
    <nav aria-label="Choose day" className="flex items-center gap-2">
      <Button
        variant="outline"
        className="size-11 p-0"
        onClick={() => onChange(prevTarget)}
        aria-label="Previous day"
      >
        <ChevronLeft aria-hidden />
      </Button>
      <p
        className="min-w-0 flex-1 truncate text-center font-heading text-lg font-semibold"
        aria-live="polite"
      >
        {formatDayLong(dayKey)}
      </p>
      <Button
        variant="outline"
        className="size-11 p-0 disabled:opacity-40"
        onClick={() => onChange(nextTarget)}
        disabled={cannotNavigateNext}
        aria-label="Next day"
      >
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
