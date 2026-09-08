/**
 * Dashboard server service.
 * Composes daily, weekly, and monthly summary loaders concurrently via Promise.all
 * and delegates all calculations to pure domain functions.
 */
import { getDaySummary } from "@/features/daily-summary/service";
import { getWeekSummary } from "@/features/weekly-summary/service";
import { getMonthSummary } from "@/features/monthly-summary/service";
import { todayKey } from "@/lib/time";
import {
  buildDailyProgressDTO,
  buildDashboardDTO,
  buildMonthlyProgressDTO,
  buildWeeklyProgressDTO,
} from "./domain";
import type { DashboardDataDTO } from "./types";

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FALLBACK_TIMEZONE = "Asia/Jakarta";

/**
 * Fetch and compose daily, weekly, and monthly dashboard progress for the given user,
 * anchor date, and timezone.
 */
export async function getDashboardData(
  userId: string,
  anchorDate: string,
  timezone: string = FALLBACK_TIMEZONE,
): Promise<DashboardDataDTO> {
  const tz = timezone || FALLBACK_TIMEZONE;
  const validAnchorDate =
    anchorDate && DAY_KEY_PATTERN.test(anchorDate) ? anchorDate : todayKey(tz);

  const [daySummary, weekSummary, monthSummary] = await Promise.all([
    getDaySummary(userId, validAnchorDate, tz),
    getWeekSummary(userId, validAnchorDate, tz),
    getMonthSummary(userId, validAnchorDate, tz),
  ]);

  const daily = buildDailyProgressDTO(daySummary, validAnchorDate, tz);
  const weekly = buildWeeklyProgressDTO(weekSummary, validAnchorDate);
  const monthly = buildMonthlyProgressDTO(monthSummary, validAnchorDate.slice(0, 7));

  return buildDashboardDTO({
    anchorDate: validAnchorDate,
    timezone: tz,
    daily,
    weekly,
    monthly,
  });
}
