/**
 * Monthly summary domain — pure aggregation of daily summaries into one
 * calendar month (DESIGN.md Phase 5), mirroring the weekly semantics. No DB,
 * no clock: the service feeds it DaySummaryDTOs and a month range, so the
 * whole month computes deterministically.
 */
import type { CategoryTotalDTO, DaySummaryDTO } from "@/lib/types";
import { addDaysISO } from "@/lib/time";

/** One day's row in the month view. */
export interface MonthDay {
  workDate: string;
  workMinutes: number;
  breakMinutes: number;
  attendanceMinutes: number;
  hasData: boolean;
}

/** Aggregate over every calendar day of one month. */
export interface MonthAggregate {
  days: MonthDay[];
  totals: {
    workMinutes: number;
    breakMinutes: number;
    attendanceMinutes: number;
    daysTracked: number;
  };
  byCategory: CategoryTotalDTO[];
}

/** First and last calendar day of the month containing dayKey ("YYYY-MM-DD"). */
export function monthRange(dayKey: string): { from: string; to: string } {
  const d = new Date(Date.parse(`${dayKey}T00:00:00Z`));
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-based
  const pad = (n: number) => String(n).padStart(2, "0");
  // Day 0 of the following month is the last day of this month — computed
  // directly from Date.UTC, not by string-subtracting a next-month first day.
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
}

/** The month window the aggregate covers — `monthRange(anchorDayKey)`'s result. */
export interface MonthRange {
  from: string;
  to: string;
}

/** A day counts as tracked when attendance exists or any entry was recorded. */
function hasData(summary: DaySummaryDTO): boolean {
  return summary.attendance !== null || summary.timeEntries.length > 0;
}

/**
 * Fold day summaries into the zero-filled month aggregate. Days in
 * [from, to] without a summary appear as zeroed rows; summaries outside
 * the range are ignored. Category order follows the input's category order.
 * Month length varies (28–31 days); ISO day keys compare lexicographically,
 * so the day loop simply walks from..to inclusive.
 */
export function aggregateMonth(
  summaries: readonly DaySummaryDTO[],
  range: MonthRange,
): MonthAggregate {
  const { from, to } = range;
  const byDate = new Map<string, DaySummaryDTO>();
  for (const summary of summaries) {
    if (summary.workDate >= from && summary.workDate <= to) {
      byDate.set(summary.workDate, summary);
    }
  }

  const days: MonthDay[] = [];
  for (let dayKey = from; dayKey <= to; dayKey = addDaysISO(dayKey, 1)) {
    const summary = byDate.get(dayKey);
    days.push({
      workDate: dayKey,
      workMinutes: summary?.totals.workMinutes ?? 0,
      breakMinutes: summary?.totals.breakMinutes ?? 0,
      attendanceMinutes: summary?.totals.attendanceMinutes ?? 0,
      hasData: summary ? hasData(summary) : false,
    });
  }

  const categoryTotals = new Map<string, CategoryTotalDTO>();
  for (const summary of byDate.values()) {
    for (const category of summary.byCategory) {
      const existing = categoryTotals.get(category.key);
      if (existing) {
        existing.minutes += category.minutes;
      } else {
        categoryTotals.set(category.key, { ...category });
      }
    }
  }

  return {
    days,
    totals: {
      workMinutes: days.reduce((sum, d) => sum + d.workMinutes, 0),
      breakMinutes: days.reduce((sum, d) => sum + d.breakMinutes, 0),
      attendanceMinutes: days.reduce((sum, d) => sum + d.attendanceMinutes, 0),
      daysTracked: days.filter((d) => d.hasData).length,
    },
    byCategory: [...categoryTotals.values()],
  };
}
