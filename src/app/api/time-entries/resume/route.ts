import { NextResponse } from "next/server";
import { errorResponse, getAuthContext, unauthorized } from "@/features/activities/api";
import { resumeTimer } from "@/features/activities/service";

/** POST /api/time-entries/resume — resume the paused entry. */
export async function POST() {
  const authCtx = await getAuthContext();
  if (!authCtx) return unauthorized();
  try {
    const entry = await resumeTimer(authCtx.userId);
    return NextResponse.json(entry);
  } catch (error) {
    return errorResponse(error);
  }
}
