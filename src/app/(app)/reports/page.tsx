import { auth } from "@/server/auth";
import { ReviewView } from "@/components/reports/review-view";
import { todayKey } from "@/lib/time";

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FALLBACK_TIMEZONE = "Asia/Jakarta";

export const metadata = {
  title: "Daily Review — TETRA",
};

interface ReportsPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await auth();
  const timeZone = session?.user?.timezone ?? FALLBACK_TIMEZONE;
  const { date } = await searchParams;
  const initialDay =
    date && DAY_KEY_PATTERN.test(date) ? date : todayKey(timeZone);

  return <ReviewView timeZone={timeZone} initialDay={initialDay} />;
}
