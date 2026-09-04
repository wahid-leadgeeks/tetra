import { redirect } from "next/navigation";

import { WeeklyView } from "@/components/reports/weekly-view";
import { getWeekSummary } from "@/features/weekly-summary/service";
import { todayKey } from "@/lib/time";
import { auth } from "@/server/auth";

export const metadata = {
  title: "Weekly Summary — TETRA",
};

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FALLBACK_TIMEZONE = "Asia/Jakarta";

interface WeekPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function WeekPage({ searchParams }: WeekPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const timeZone = session.user.timezone || FALLBACK_TIMEZONE;

  const sp = await searchParams;
  const anchorDay =
    sp.date && DAY_KEY_PATTERN.test(sp.date) ? sp.date : todayKey(timeZone);

  const week = await getWeekSummary(session.user.id, anchorDay, timeZone);

  return <WeeklyView week={week} />;
}
