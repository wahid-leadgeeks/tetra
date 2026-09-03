/**
 * Shared POST shell for the attendance/break endpoints.
 * Keeps route handlers thin: 401 when unauthenticated, Zod-validated
 * (empty) body, service Error → 400 {error}, success → AttendanceDTO.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import type { AttendanceDTO } from "@/lib/types";
import { auth } from "@/server/auth";

const EmptyBody = z.object({});

export async function postAttendance(
  req: Request,
  action: (userId: string, timezone: string) => Promise<AttendanceDTO>,
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: userId, timezone } = session.user;
  try {
    const raw = await req.json().catch(() => null);
    EmptyBody.parse(raw ?? {});
    return NextResponse.json(await action(userId, timezone));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
