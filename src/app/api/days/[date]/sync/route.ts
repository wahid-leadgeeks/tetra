import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORY_KEYS, type CategoryKey } from "@/features/sheets-sync/mapping";
import {
  executeSync,
  previewSync,
  SheetsApiError,
} from "@/features/sheets-sync/service";
import { auth } from "@/server/auth";

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const syncOptionsSchema = z.object({
  includeNotes: z.boolean().optional(),
  notes: z.record(z.string(), z.string().optional()).optional(),
});

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

async function requireAuth(): Promise<
  { ok: true; userId: string; accessToken?: string } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: jsonError(401, "Unauthorized") };
  }
  return {
    ok: true,
    userId: session.user.id,
    accessToken: session.accessToken,
  };
}

/** Preview the exact cells a sync would write — no sheet mutation. */
export async function GET(
  _req: NextRequest,
  ctx: SyncRouteContext,
): Promise<NextResponse> {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  const { date } = await ctx.params;
  if (!DAY_KEY_PATTERN.test(date)) {
    return jsonError(400, "Invalid date, expected YYYY-MM-DD");
  }

  try {
    const preview = await previewSync(authResult.userId, date, {
      accessToken: authResult.accessToken,
    });
    return NextResponse.json(preview);
  } catch (err) {
    return syncErrorResponse(err);
  }
}

/** Execute the sync after review. Idempotent; retriable on 502. */
export async function POST(
  request: NextRequest,
  ctx: SyncRouteContext,
): Promise<NextResponse> {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  const { date } = await ctx.params;
  if (!DAY_KEY_PATTERN.test(date)) {
    return jsonError(400, "Invalid date, expected YYYY-MM-DD");
  }

  const body = await request.json().catch(() => ({}));
  const parsedOptions = syncOptionsSchema.safeParse(body);
  if (!parsedOptions.success) {
    return jsonError(400, firstIssue(parsedOptions.error));
  }

  const notesOverrides: Partial<Record<CategoryKey, string>> | undefined =
    parsedOptions.data.notes
      ? Object.fromEntries(
          Object.entries(parsedOptions.data.notes).filter(
            (entry): entry is [CategoryKey, string] =>
              CATEGORY_KEYS.includes(entry[0] as CategoryKey) &&
              typeof entry[1] === "string",
          ),
        )
      : undefined;

  try {
    const result = await executeSync(authResult.userId, date, {
      includeNotes: parsedOptions.data.includeNotes,
      notes: notesOverrides,
      accessToken: authResult.accessToken,
    });
    return NextResponse.json(result);
  } catch (err) {
    return syncErrorResponse(err);
  }
}

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid sync options";
  const path = issue.path.map(String).join(".");
  return `${path || "body"}: ${issue.message}`;
}
