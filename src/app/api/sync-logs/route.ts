import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listSyncLogs } from "@/features/sheets-sync/service";
import { auth } from "@/server/auth";

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Sync history, newest first. Optional ?date=YYYY-MM-DD filter. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, "Unauthorized");
  }

  const date = req.nextUrl.searchParams.get("date");
  if (date && !DAY_KEY_PATTERN.test(date)) {
    return jsonError(400, "Invalid date, expected YYYY-MM-DD");
  }

  const logs = await listSyncLogs(session.user.id, { date: date ?? undefined });
  return NextResponse.json(logs);
}
