import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  executeSync,
  previewSync,
  SheetsApiError,
} from "@/features/sheets-sync/service";
import { auth } from "@/server/auth";

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface SyncRouteContext {
  params: Promise<{ date: string }>;
}

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * SyncNotConfiguredError and business errors (not reviewed, date row not
 * found, invalid input) → 400. Google API failures → 502.
 */
function syncErrorResponse(err: unknown): NextResponse {
  if (err instanceof SheetsApiError) return jsonError(502, err.message);
  if (err instanceof Error) return jsonError(400, err.message);
  return jsonError(400, "Sync failed");
}

async function requireUserId(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: jsonError(401, "Unauthorized") };
  }
  return { ok: true, userId: session.user.id };
}

/** Preview the exact cells a sync would write — no sheet mutation. */
export async function GET(
  _req: NextRequest,
  ctx: SyncRouteContext,
): Promise<NextResponse> {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  const { date } = await ctx.params;
  if (!DAY_KEY_PATTERN.test(date)) {
    return jsonError(400, "Invalid date, expected YYYY-MM-DD");
  }

  try {
    const preview = await previewSync(authResult.userId, date);
    return NextResponse.json(preview);
  } catch (err) {
    return syncErrorResponse(err);
  }
}

/** Execute the sync after review. Idempotent; retriable on 502. */
export async function POST(
  _req: NextRequest,
  ctx: SyncRouteContext,
): Promise<NextResponse> {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  const { date } = await ctx.params;
  if (!DAY_KEY_PATTERN.test(date)) {
    return jsonError(400, "Invalid date, expected YYYY-MM-DD");
  }

  try {
    const result = await executeSync(authResult.userId, date);
    return NextResponse.json(result);
  } catch (err) {
    return syncErrorResponse(err);
  }
}
