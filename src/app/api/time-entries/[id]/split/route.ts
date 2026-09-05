import { NextResponse } from "next/server";
import { z } from "zod";
import {
  badRequest,
  errorResponse,
  firstIssueMessage,
  getAuthContext,
  parseJsonBody,
  unauthorized,
} from "@/features/activities/api";
import { splitTimeEntry } from "@/features/activities/service";

const idSchema = z.uuid();

const splitSchema = z.object({
  splitAt: z.iso.datetime(),
  secondTaskName: z.string().trim().min(1).optional(),
  secondCategoryId: z.uuid().optional(),
});

/**
 * POST /api/time-entries/:id/split — split a completed entry into two
 * consecutive entries at `splitAt`; 409 on overlap with other entries.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await getAuthContext();
  if (!authCtx) return unauthorized();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return badRequest("Invalid entry id");
  const parsed = splitSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return badRequest(firstIssueMessage(parsed.error));
  try {
    const result = await splitTimeEntry(
      authCtx.userId,
      authCtx.timezone,
      id,
      parsed.data.splitAt,
      parsed.data.secondTaskName,
      parsed.data.secondCategoryId,
    );
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
