import { redirect } from "next/navigation";

import { MonthlyView } from "@/components/reports/monthly-view";
import { getMonthSummary } from "@/features/monthly-summary/service";
import { todayKey } from "@/lib/time";
import { auth } from "@/server/auth";

export const metadata = {
  title: "Monthly Summary — TETRA",
};

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FALLBACK_TIMEZONE = "Asia/Jakarta";

interface MonthPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function MonthPage({ searchParams }: MonthPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const timeZone = session.user.timezone || FALLBACK_TIMEZONE;

  const sp = await searchParams;
  const anchorDay =
    sp.date && DAY_KEY_PATTERN.test(sp.date) ? sp.date : todayKey(timeZone);

  const month = await getMonthSummary(session.user.id, anchorDay, timeZone);

  return <MonthlyView month={month} />;
}
