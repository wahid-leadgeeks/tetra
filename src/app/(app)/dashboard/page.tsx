import { redirect } from "next/navigation";

import { DashboardView, type DashboardTab } from "@/components/dashboard/dashboard-view";
import { getDashboardData } from "@/features/dashboard/service";
import { todayKey } from "@/lib/time";
import { auth } from "@/server/auth";

export const metadata = {
  title: "Dashboard — TETRA",
  description: "Daily, weekly, and monthly time tracking progress and targets.",
};

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TABS = ["overview", "daily", "weekly", "monthly"] as const;
const FALLBACK_TIMEZONE = "Asia/Jakarta";

interface DashboardPageProps {
  searchParams: Promise<{ date?: string; tab?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const timeZone = session.user.timezone || FALLBACK_TIMEZONE;
  const sp = await searchParams;

  const anchorDate =
    sp.date && DAY_KEY_PATTERN.test(sp.date) ? sp.date : todayKey(timeZone);

  const initialTab: DashboardTab =
    sp.tab && (VALID_TABS as readonly string[]).includes(sp.tab)
      ? (sp.tab as DashboardTab)
      : "overview";

  const data = await getDashboardData(session.user.id, anchorDate, timeZone);

  return <DashboardView initialData={data} initialTab={initialTab} />;
}
