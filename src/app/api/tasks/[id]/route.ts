import { NextResponse } from "next/server";
import { z } from "zod";

import {
  badRequest,
  getAuthContext,
  unauthorized,
} from "@/features/activities/api";
import { deleteTask, updateTask } from "@/features/activities/service";

const updateTaskSchema = z.object({
  name: z.string().trim().min(1, "Task name cannot be empty").max(300).optional(),
  categoryId: z.string().uuid("Invalid category ID").optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  description: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
});

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

    const task = await updateTask(authCtx.userId, id, parsed.data);
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
    const success = await deleteTask(authCtx.userId, id);
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
