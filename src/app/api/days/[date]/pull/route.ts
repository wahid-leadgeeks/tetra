import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SheetsApiError, pullDayFromSheet } from "@/features/sheets-sync/service";
import { auth } from "@/server/auth";

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface PullRouteContext {
  params: Promise<{ date: string }>;
}

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function pullErrorResponse(err: unknown): NextResponse {
  if (err instanceof SheetsApiError) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("invalid authentication credentials") ||
      msg.includes("invalid_grant") ||
      msg.includes("google oauth access expired")
    ) {
      return jsonError(401, "Google OAuth session expired. Please sign in again.");
    }
    return jsonError(502, err.message);
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("invalid authentication credentials") ||
      msg.includes("invalid_grant") ||
      msg.includes("google oauth access expired")
    ) {
      return jsonError(401, "Google OAuth session expired. Please sign in again.");
    }
    return jsonError(400, err.message);
  }
  return jsonError(400, "Pull failed");
}

/** POST /api/days/:date/pull — Pull tracking data from Google Sheets into TETRA. */
export async function POST(
  _request: NextRequest,
  ctx: PullRouteContext,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, "Unauthorized");
  }

  const { date } = await ctx.params;
  if (!DAY_KEY_PATTERN.test(date)) {
    return jsonError(400, "Invalid date, expected YYYY-MM-DD");
  }

  try {
    const summary = await pullDayFromSheet(session.user.id, date, {
      accessToken: session.accessToken,
    });
    return NextResponse.json(summary);
  } catch (err) {
    return pullErrorResponse(err);
  }
}
