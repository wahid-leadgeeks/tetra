/**
 * Monthly summary service — folds every daily summary of one calendar month
 * (daily-summary kernel, imported not recreated) into one month aggregate
 * for the RSC page.
 */
import type { DaySummaryDTO } from "@/lib/types";
import { addDaysISO } from "@/lib/time";
import { getDaySummary } from "@/features/daily-summary/service";
import { aggregateMonth, monthRange, type MonthAggregate } from "./domain";

export type MonthSummary = MonthAggregate & { from: string; to: string };

/**
 * The month containing anchorDayKey: one `getDaySummary` load per calendar
 * day (sequential — cheap indexed queries) folded by the pure domain. Month
 * length varies (28–31 days); ISO day keys compare lexicographically, so the
 * loop walks while dayKey <= to.
 */
export async function getMonthSummary(
  userId: string,
  anchorDayKey: string,
  tz: string,
): Promise<MonthSummary> {
  const { from, to } = monthRange(anchorDayKey);

  const summaries: DaySummaryDTO[] = [];
  for (let dayKey = from; dayKey <= to; dayKey = addDaysISO(dayKey, 1)) {
    summaries.push(await getDaySummary(userId, dayKey, tz));
  }

  return { ...aggregateMonth(summaries, { from, to }), from, to };
}
