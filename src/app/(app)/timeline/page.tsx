import { auth } from "@/server/auth";
import { TimelineView } from "@/components/timeline/timeline-view";
import { ensureWorkday, todayKey } from "@/lib/time";
import { db } from "@/server/db";
import { dailyAttendance } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FALLBACK_TIMEZONE = "Asia/Jakarta";

export const metadata = {
  title: "Timeline — TETRA",
};

interface TimelinePageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function TimelinePage({ searchParams }: TimelinePageProps) {
  const session = await auth();
  const timeZone = session?.user?.timezone ?? FALLBACK_TIMEZONE;
  const { date } = await searchParams;
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

  return <TimelineView timeZone={timeZone} initialDay={initialDay} />;
}
