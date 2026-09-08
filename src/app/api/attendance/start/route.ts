import { NextResponse } from "next/server";
import { z } from "zod";
import { clockIn } from "@/features/attendance/service";
import { syncClockIn } from "@/features/sheets-sync/service";
import { auth } from "@/server/auth";

const EmptyBody = z.object({});

/** POST /api/attendance/start — clock in for today & auto-sync clock-in to Google Sheets. */
export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId, timezone } = session.user;
  try {
    const raw = await req.json().catch(() => null);
    EmptyBody.parse(raw ?? {});

    const attendance = await clockIn(userId, timezone);

    // Auto-sync clock-in time to Google Sheets if configured
    const autoSyncResult = await syncClockIn(
      userId,
      attendance.workDate,
      attendance.clockInAt,
      { accessToken: session.accessToken },
    );

    return NextResponse.json({
      ...attendance,
      autoSync: autoSyncResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
