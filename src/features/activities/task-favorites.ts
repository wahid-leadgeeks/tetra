/**
 * Task favorites: the star flag on tasks, plus the favorites-only read
 * behind the Today screen's Quick start chips.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import type { TaskDTO } from "@/lib/types";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";

type TaskRow = typeof tasks.$inferSelect;

function toTaskDTO(row: TaskRow): TaskDTO {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    isFavorite: row.isFavorite,
    lastUsedAt: row.lastUsedAt === null ? null : row.lastUsedAt.toISOString(),
  };
}

/**
 * Set the favorite flag on one of the user's tasks and return the updated
 * task. Throws when the task does not exist for that user.
 */
export async function setTaskFavorite(
  userId: string,
  taskId: string,
  isFavorite: boolean,
): Promise<TaskDTO> {
  const rows = await db
    .update(tasks)
    .set({ isFavorite })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning();
  const row = rows[0];
  if (row === undefined) throw new Error("Task not found");
  return toTaskDTO(row);
}

/** Favorite tasks for Quick start chips, most recently used first. */
export async function listFavoriteTasks(
  userId: string,
  limit = 8,
): Promise<TaskDTO[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.isFavorite, true)))
    .orderBy(sql`${tasks.lastUsedAt} desc nulls last`, asc(tasks.name))
    .limit(limit);
  return rows.map(toTaskDTO);
}
