"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatDayLong,
  isToday,
  nextDay,
  previousDay,
} from "@/components/timeline/time";

interface DayNavigatorProps {
  dayKey: string;
  timeZone: string;
  onChange: (dayKey: string) => void;
}

/**
 * ‹ prev / date / next › navigator. Future days are blocked — TETRA records
 * work as it happens; backfilling is per-entry from the Timeline.
 */
export function DayNavigator({ dayKey, timeZone, onChange }: DayNavigatorProps) {
  const atToday = isToday(dayKey, timeZone);

  return (
    <nav aria-label="Choose day" className="flex items-center gap-2">
      <Button
        variant="outline"
        className="size-11 p-0"
        onClick={() => onChange(previousDay(dayKey))}
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
        onClick={() => onChange(nextDay(dayKey))}
        disabled={atToday}
        aria-label="Next day"
      >
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
