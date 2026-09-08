import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getAvailableCalendars,
  getCalendarConfig,
  updateCalendarConfig,
} from "@/features/calendar-sync/service";
import { auth } from "@/server/auth";

const configSchema = z.object({
  calendarId: z.string().optional(),
  calendarName: z.string().optional(),
  syncEnabled: z.boolean().optional(),
  categoryRules: z.array(z.any()).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await getCalendarConfig(session.user.id);
    const calendars = await getAvailableCalendars(session.user.id);
    return NextResponse.json({ config, calendars });
  } catch (err) {
    console.error("Failed to load calendar configuration:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load config" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = configSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid config payload", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const updated = await updateCalendarConfig(session.user.id, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Failed to update calendar configuration:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update config" },
      { status: 500 },
    );
  }
}
