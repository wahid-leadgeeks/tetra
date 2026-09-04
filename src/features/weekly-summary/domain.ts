/**
 * Weekly summary domain — pure aggregation of daily summaries into one week
 * (DESIGN.md Phase 5). No DB, no clock: the service feeds it DaySummaryDTOs
 * and a Monday-anchored range, so the whole week computes deterministically.
 */
import type { CategoryTotalDTO, DaySummaryDTO } from "@/lib/types";
import { addDaysISO } from "@/lib/time";

/** One day's row in the week view. */
export interface WeekDay {
  workDate: string;
  workMinutes: number;
  breakMinutes: number;
  attendanceMinutes: number;
  hasData: boolean;
}

/** Aggregate over the seven days of one ISO week (Monday-first). */
export interface WeekAggregate {
  days: WeekDay[];
  totals: {
    workMinutes: number;
    breakMinutes: number;
    attendanceMinutes: number;
    daysTracked: number;
  };
  byCategory: CategoryTotalDTO[];
}

/** Monday..Sunday of the ISO week containing dayKey ("YYYY-MM-DD", Monday-first). */
export function weekRange(dayKey: string): { from: string; to: string } {
  const d = new Date(Date.parse(`${dayKey}T00:00:00Z`));
  // getUTCDay(): 0=Sunday..6=Saturday → Monday-first offset
  const offset = (d.getUTCDay() + 6) % 7;
  const from = addDaysISO(dayKey, -offset);
  return { from, to: addDaysISO(from, 6) };
}

/** The week window the aggregate covers — `weekRange(anchorDayKey)`'s result. */
export interface WeekRange {
  from: string;
  to: string;
}

/** A day counts as tracked when attendance exists or any entry was recorded. */
function hasData(summary: DaySummaryDTO): boolean {
  return summary.attendance !== null || summary.timeEntries.length > 0;
}

/**
 * Fold day summaries into the zero-filled week aggregate. Days in
 * [from, to] without a summary appear as zeroed rows; summaries outside
 * the range are ignored. Category order follows the input's category order.
 */
export function aggregateWeek(
  summaries: DaySummaryDTO[],
  range: WeekRange,
): WeekAggregate {
  const { from, to } = range;
  const byDate = new Map<string, DaySummaryDTO>();
  for (const summary of summaries) {
    if (summary.workDate >= from && summary.workDate <= to) {
      byDate.set(summary.workDate, summary);
    }
  }

  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const workDate = addDaysISO(from, i);
    if (workDate > to) break;
    const summary = byDate.get(workDate);
    days.push({
      workDate,
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
