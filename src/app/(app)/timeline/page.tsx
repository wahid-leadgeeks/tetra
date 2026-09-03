import { auth } from "@/server/auth";
import { TimelineView } from "@/components/timeline/timeline-view";
import { todayKey } from "@/lib/time";

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
  const initialDay =
    date && DAY_KEY_PATTERN.test(date) ? date : todayKey(timeZone);

  return <TimelineView timeZone={timeZone} initialDay={initialDay} />;
}
