/**
 * Shared helpers for the activity API routes: session access and the
 * error → HTTP mapping (OverlapError → 409 with details, others → 400).
 */
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { OverlapError } from "./domain";

export interface AuthContext {
  userId: string;
  timezone: string;
}

/** Session context, or null when unauthenticated. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return { userId, timezone: session.user.timezone };
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof OverlapError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: 409 },
    );
  }
  return badRequest(error instanceof Error ? error.message : "Request failed");
}

/** Parse a JSON request body, or null when the payload is not JSON. */
export async function parseJsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

/** First Zod issue message, for concise 400 responses. */
export function firstIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid request";
}
