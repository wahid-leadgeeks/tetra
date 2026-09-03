import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, getAuthContext, unauthorized } from "@/features/activities/api";
import { listRecentTasks } from "@/features/activities/service";

const limitSchema = z.coerce.number().int().min(1).max(50).optional();

/** GET /api/tasks/recent?limit=8 — recently used tasks. */
export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx) return unauthorized();
  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = limitSchema.safeParse(limitParam ?? undefined);
  if (!limit.success) return badRequest("Invalid limit: expected 1–50");
  const tasks = await listRecentTasks(authCtx.userId, limit.data);
  return NextResponse.json(tasks);
}
