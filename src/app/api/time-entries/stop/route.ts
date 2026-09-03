import { NextResponse } from "next/server";
import { errorResponse, getAuthContext, unauthorized } from "@/features/activities/api";
import { stopTimer } from "@/features/activities/service";

/** POST /api/time-entries/stop — stop the current entry. */
export async function POST() {
  const authCtx = await getAuthContext();
  if (!authCtx) return unauthorized();
  try {
    const entry = await stopTimer(authCtx.userId, authCtx.timezone);
    return NextResponse.json(entry);
  } catch (error) {
    return errorResponse(error);
  }
}
