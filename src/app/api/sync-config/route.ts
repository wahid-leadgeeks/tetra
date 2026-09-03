import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSyncConfig, upsertSyncConfig } from "@/features/sheets-sync/service";
import { auth } from "@/server/auth";

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
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

/** The user's active spreadsheet config, or null. */
export async function GET(): Promise<NextResponse> {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  const config = await getSyncConfig(authResult.userId);
  return NextResponse.json(config);
}

/** Create or replace the single active spreadsheet config. */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  try {
    const config = await upsertSyncConfig(authResult.userId, body);
    return NextResponse.json(config);
  } catch (err) {
    if (err instanceof Error) return jsonError(400, err.message);
    return jsonError(400, "Invalid sync config");
  }
}
