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
import { setTaskFavorite } from "@/features/activities/task-favorites";

const idSchema = z.uuid();

const patchSchema = z.object({
  isFavorite: z.boolean(),
});

/** PATCH /api/tasks/:id/favorite — star or unstar a task for Quick start. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await getAuthContext();
  if (!authCtx) return unauthorized();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return badRequest("Invalid task id");
  const parsed = patchSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return badRequest(firstIssueMessage(parsed.error));
  try {
    const task = await setTaskFavorite(
      authCtx.userId,
      id,
      parsed.data.isFavorite,
    );
    return NextResponse.json(task);
  } catch (error) {
    return errorResponse(error);
  }
}
