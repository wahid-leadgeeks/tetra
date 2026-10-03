"use client";

import { ArrowRight, CalendarX2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getBackfillPosition } from "@/components/reports/review-step";
import { formatDayShort } from "@/components/timeline/time";

interface BackfillNavProps {
  /** Missing days (YYYY-MM-DD), sorted ascending. */
  days: readonly string[];
  currentDay: string;
  onJump: (nextDay: string) => void;
  /** True while navigation to the next day is in flight. */
  pending?: boolean;
}

/**
 * Steps through the missing days the notification banner sent us here to
 * backfill (`/reports?date=<oldest>&backfill=<d1,d2,...>`).
 */
export function BackfillNav({ days, currentDay, onJump, pending = false }: BackfillNavProps) {
  if (days.length === 0) return null;

  const { index, next } = getBackfillPosition(days, currentDay);

  return (
    <nav
      aria-label="Backfill missing days"
      data-testid="backfill-nav"
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.04] px-3 py-2 dark:bg-rose-500/[0.07]"
    >
      <p className="flex items-center gap-2 text-sm text-foreground">
        <CalendarX2 aria-hidden className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
        <span>
          Backfilling missing days
          {index >= 0 && (
            <span className="text-muted-foreground tabular-nums" data-testid="backfill-counter">
              {" "}· {index + 1} of {days.length}
            </span>
          )}
        </span>
      </p>
      <Button
        variant="outline"
        size="sm"
        className="h-11 px-3 sm:h-9"
        disabled={next === null || pending}
        onClick={() => {
          if (next) onJump(next);
        }}
        data-testid="backfill-next"
      >
        {next ? `Next missing day: ${formatDayShort(next)}` : "No more missing days"}
        <ArrowRight aria-hidden />
      </Button>
    </nav>
  );
}
