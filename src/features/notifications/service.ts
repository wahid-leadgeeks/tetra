import { eq } from "drizzle-orm";
import { getDaySummary } from "@/features/daily-summary/service";
import { getWeekSummary } from "@/features/weekly-summary/service";
import { getCalendarSchedule } from "@/features/calendar-sync/service";
import { addDaysISO, todayKey } from "@/lib/time";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { generateCompanionAlerts } from "./domain";
import type { TetraNotification } from "./types";

/**
 * Evaluates actionable companion alerts for time gaps, unlogged meetings,
 * missing work days, weekly target deficit (<40h), forgotten timers, extended breaks,
 * and unsynced days.
 */
export async function getCompanionAlerts(userId: string): Promise<TetraNotification[]> {
  const userRows = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const tz = userRows[0]?.timezone || "Asia/Jakarta";
  const currentTodayKey = todayKey(tz);
  const yesterdayKey = addDaysISO(currentTodayKey, -1);
  const now = new Date();

  const [daySummary, weekSummary, calendarData, yesterdaySummary] = await Promise.all([
    getDaySummary(userId, currentTodayKey, tz).catch((err) => {
      console.warn("Could not fetch daySummary for alerts:", err);
      return null;
    }),
    getWeekSummary(userId, currentTodayKey, tz).catch((err) => {
      console.warn("Could not fetch weekSummary for alerts:", err);
      return null;
    }),
    getCalendarSchedule(userId, currentTodayKey, tz).catch((err) => {
      console.warn("Could not fetch calendarData for alerts:", err);
      return null;
    }),
    getDaySummary(userId, yesterdayKey, tz).catch((err) => {
      console.warn("Could not fetch yesterdaySummary for alerts:", err);
      return null;
    }),
  ]);

  if (!daySummary) {
    return [];
  }

  const hasUnsyncedYesterday = !!(
    yesterdaySummary?.attendance &&
    yesterdaySummary.reviewState !== "synced"
  );

  return generateCompanionAlerts({
    todayKey: currentTodayKey,
    now,
    daySummary,
    weekSummary,
    calendarEvents: calendarData?.events,
    hasUnsyncedYesterday,
    yesterdayKey,
  });
}
