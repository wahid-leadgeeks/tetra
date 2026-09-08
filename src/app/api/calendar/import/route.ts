import { NextResponse } from "next/server";
import { z } from "zod";

import { importCalendarEvents } from "@/features/calendar-sync/service";
import { auth } from "@/server/auth";

const importSchema = z.object({
  events: z.array(
    z.object({
      eventId: z.string(),
      title: z.string().min(1),
      categoryKey: z.string().min(1),
      startedAt: z.string().datetime(),
      endedAt: z.string().datetime(),
      notes: z.string().nullable().optional(),
    }),
  ),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid import payload", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const result = await importCalendarEvents(session.user.id, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to import calendar events:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to import events" },
      { status: 500 },
    );
  }
}
