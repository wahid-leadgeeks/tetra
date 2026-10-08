import { NextResponse } from "next/server";

import {
  badRequest,
  getAuthContext,
  unauthorized,
} from "@/features/activities/api";
import { deleteTask, updateTask } from "@/features/activities/service";
import { updateTaskSchema } from "@/features/activities/task-schemas";

/** PATCH /api/tasks/:id — update a task. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await getAuthContext();
  if (!authCtx) return unauthorized();

  const { id } = await params;
  if (!id) return badRequest("Task ID is required");

  try {
    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid payload");
    }

    const task = await updateTask(authCtx.userId, id, parsed.data, authCtx.timezone);
    return NextResponse.json(task);
  } catch (err) {
    console.error("Failed to update task:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update task" },
      { status: 500 },
    );
  }
}

/** DELETE /api/tasks/:id — delete a task. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await getAuthContext();
  if (!authCtx) return unauthorized();

  const { id } = await params;
  if (!id) return badRequest("Task ID is required");

  try {
    const success = await deleteTask(authCtx.userId, id, authCtx.timezone);
    if (!success) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete task:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete task" },
      { status: 500 },
    );
  }
}
