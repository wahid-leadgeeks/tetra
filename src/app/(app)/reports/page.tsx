import { auth } from "@/server/auth";
import { ReviewView } from "@/components/reports/review-view";
import { ensureWorkday, todayKey } from "@/lib/time";
import { db } from "@/server/db";
import { dailyAttendance } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FALLBACK_TIMEZONE = "Asia/Jakarta";

export const metadata = {
  title: "Daily Review — TETRA",
};

interface ReportsPageProps {
  searchParams: Promise<{ date?: string; backfill?: string }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await auth();
  const timeZone = session?.user?.timezone ?? FALLBACK_TIMEZONE;
  const { date, backfill } = await searchParams;
  // Contract with the notification banner: `?backfill=<d1,d2,...>` lists the
  // missing days to step through (see collapseMissingDayAlerts).
  const backfillDays = [
    ...new Set((backfill ?? "").split(",").filter((d) => DAY_KEY_PATTERN.test(d))),
  ].sort();
  const today = todayKey(timeZone);

  let initialDay: string;
  if (date && DAY_KEY_PATTERN.test(date)) {
    initialDay = date;
  } else {
    // If the user has attendance today, always display today (including weekends).
    const hasTodayAttendance = session?.user?.id
      ? (
          await db
            .select({ id: dailyAttendance.id })
            .from(dailyAttendance)
            .where(
              and(
                eq(dailyAttendance.userId, session.user.id),
                eq(dailyAttendance.workDate, today),
              ),
            )
            .limit(1)
        ).length > 0
      : false;

    initialDay = hasTodayAttendance ? today : ensureWorkday(today);
  }

  return (
    <ReviewView
      key={`${initialDay}|${backfillDays.join(",")}`}
      timeZone={timeZone}
      initialDay={initialDay}
      backfillDays={backfillDays}
    />
  );
}
