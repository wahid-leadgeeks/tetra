import { NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/features/calendar-sync/service";
import { auth } from "@/server/auth";

const guestSchema = z.union([
  z.string().email(),
  z.object({
    email: z.string().email(),
    displayName: z.string().optional(),
  }),
]);

const updateEventSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").max(500).optional(),
  description: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  allDay: z.boolean().optional(),
  guests: z.array(guestSchema).optional(),
  createMeet: z.boolean().optional(),
  sendUpdates: z.enum(["all", "none"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing event ID" }, { status: 400 });
  }

  const timeZone = session.user.timezone || "Asia/Jakarta";

  try {
    const body = await request.json();
    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: parsed.error.format(),
        },
        { status: 400 },
      );
    }

    const event = await updateCalendarEvent(session.user.id, id, parsed.data, timeZone);
    return NextResponse.json({ event });
  } catch (err) {
    console.error("Failed to update calendar event:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update calendar event" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing event ID" }, { status: 400 });
  }

  try {
    const success = await deleteCalendarEvent(session.user.id, id);
    if (!success) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete calendar event:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete calendar event" },
      { status: 500 },
    );
  }
}
