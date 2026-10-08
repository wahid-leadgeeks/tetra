import { NextResponse } from "next/server";
import {
  SheetsApiError,
  SyncNotConfiguredError,
} from "@/features/sheets-sync/errors";

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * SyncNotConfiguredError → 400 with `code: "not_configured"`; other business
 * errors (not reviewed, date row not found, invalid input) → 400. Google API
 * failures → 502. Lives outside route.ts because Next route files may only
 * export handlers.
 */
export function syncErrorResponse(err: unknown): NextResponse {
  if (err instanceof SyncNotConfiguredError) {
    return NextResponse.json(
      { error: err.message, code: "not_configured" },
      { status: 400 },
    );
  }
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
  if (err instanceof Error) return jsonError(400, err.message);
  return jsonError(400, "Sync failed");
}
