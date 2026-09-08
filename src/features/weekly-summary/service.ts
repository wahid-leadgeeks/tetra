/**
 * Weekly summary service — folds seven daily summaries (daily-summary
 * kernel, imported not recreated) into one week aggregate for the RSC page.
 */
import { addDaysISO } from "@/lib/time";
import { getBatchDaySummaries } from "@/features/monthly-summary/service";
import { aggregateWeek, weekRange, type WeekAggregate } from "./domain";

export type WeekSummary = WeekAggregate & { from: string; to: string };

/**
 * The week containing anchorDayKey: batch loads 7 daily summaries in a single
 * indexed batch query and aggregates via the pure domain.
 */
export async function getWeekSummary(
  userId: string,
  anchorDayKey: string,
  tz: string,
): Promise<WeekSummary> {
  const { from, to } = weekRange(anchorDayKey);

  const dayKeys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dayKey = addDaysISO(from, i);
    dayKeys.push(dayKey);
    if (dayKey === to) break;
  }

  const summaries = await getBatchDaySummaries(userId, dayKeys, tz);
  return { ...aggregateWeek(summaries, { from, to }), from, to };
}
