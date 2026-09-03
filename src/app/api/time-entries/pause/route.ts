import { NextResponse } from "next/server";
import { errorResponse, getAuthContext, unauthorized } from "@/features/activities/api";
import { pauseTimer } from "@/features/activities/service";

/** POST /api/time-entries/pause — pause the running entry. */
export async function POST() {
  const authCtx = await getAuthContext();
  if (!authCtx) return unauthorized();
  try {
    const entry = await pauseTimer(authCtx.userId);
    return NextResponse.json(entry);
  } catch (error) {
    return errorResponse(error);
  }
}
