/**
 * Weekly summary service — folds seven daily summaries (daily-summary
 * kernel, imported not recreated) into one week aggregate for the RSC page.
 */
import type { DaySummaryDTO } from "@/lib/types";
import { addDaysISO } from "@/lib/time";
import { getDaySummary } from "@/features/daily-summary/service";
import { aggregateWeek, weekRange, type WeekAggregate } from "./domain";

export type WeekSummary = WeekAggregate & { from: string; to: string };

/**
 * The week containing anchorDayKey: seven `getDaySummary` loads (sequential —
 * seven cheap indexed queries) folded by the pure domain. The range is 7 days
 * by construction (weekRange), so the fold is unconditionally capped.
 */
export async function getWeekSummary(
  userId: string,
  anchorDayKey: string,
  tz: string,
): Promise<WeekSummary> {
  const { from, to } = weekRange(anchorDayKey);

  const summaries: DaySummaryDTO[] = [];
  for (let i = 0; i < 7; i++) {
    const dayKey = addDaysISO(from, i);
    summaries.push(await getDaySummary(userId, dayKey, tz));
    if (dayKey === to) break;
  }

  return { ...aggregateWeek(summaries, { from, to }), from, to };
}
