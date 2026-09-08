import { NextResponse } from "next/server";

import { getCalendarSchedule } from "@/features/calendar-sync/service";
import { todayKey } from "@/lib/time";
import { auth } from "@/server/auth";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeZone = session.user.timezone || "Asia/Jakarta";
  const dateParam = searchParams.get("date");
  const dayKey = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayKey(timeZone);

  try {
    const result = await getCalendarSchedule(session.user.id, dayKey, timeZone);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to load calendar schedule:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load calendar schedule" },
      { status: 500 },
    );
  }
}
