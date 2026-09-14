/**
 * Manual entry corrections: create, update, delete.
 * Every write re-validates overlaps server-side and flags synced days
 * as `changed_after_sync`.
 */
import { and, eq } from "drizzle-orm";
import { expandAttendanceBounds } from "@/features/attendance/service";
import { todayKey, zonedDayKey } from "@/lib/time";
import type { TaskDTO, TaskStatus, TimeEntryDTO } from "@/lib/types";
import { db } from "@/server/db";
import { categories, tasks, timeEntries } from "@/server/db/schema";
import { validateNoOverlap } from "./domain";
import {
  accumulatePause,
  assertCategoryExists,
  fetchEntriesInRange,
  markDayChanged,
  requireEntryDto,
  upsertTask,
} from "./entry-helpers";

export interface ManualEntryInput {
  startedAt: Date;
  endedAt: Date;
  taskName: string;
  categoryId: string;
  notes?: string;
}

export interface UpdateEntryPatch {
  startedAt?: Date;
  endedAt?: Date;
  notes?: string;
  categoryId?: string;
  taskName?: string;
}

/** Create a manual (backfilled) entry; rejected with OverlapError on conflict. */
export async function createManualEntry(
  userId: string,
  timeZone: string,
  input: ManualEntryInput,
): Promise<TimeEntryDTO> {
  if (input.endedAt.getTime() <= input.startedAt.getTime()) {
    throw new Error("End time must be after start time");
  }
  const now = new Date();
  const entryId = await db.transaction(async (tx) => {
    await assertCategoryExists(tx, input.categoryId);
    const { entries, taskNamesById } = await fetchEntriesInRange(
      tx,
      userId,
      input.startedAt,
      input.endedAt,
    );
    validateNoOverlap(
      {
        taskName: input.taskName,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
      },
      entries,
      taskNamesById,
      timeZone,
      now,
    );
    const task = await upsertTask(
      tx,
      userId,
      input.taskName,
      input.categoryId,
      now,
    );
    const created = await tx
      .insert(timeEntries)
      .values({
        userId,
        taskId: task.id,
        categoryId: input.categoryId,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        status: "completed",
        source: "manual",
        notes: input.notes ?? null,
        pausedSeconds: 0,
      })
      .returning({ id: timeEntries.id });
    const newEntry = created[0];
    if (newEntry === undefined) throw new Error("Failed to create entry");
    const dayKey = zonedDayKey(input.startedAt, timeZone);
    await expandAttendanceBounds(
      tx,
      userId,
      dayKey,
      { startedAt: input.startedAt, endedAt: input.endedAt },
      true,
      dayKey === todayKey(timeZone),
    );
    await markDayChanged(tx, userId, dayKey);
    return newEntry.id;
  });
  return requireEntryDto(userId, entryId);
}

/** Edit an entry (times, notes, category, task). Overlaps re-validated. */
export async function updateEntry(
  userId: string,
  id: string,
  patch: UpdateEntryPatch,
  timeZone: string,
): Promise<TimeEntryDTO> {
  const now = new Date();
  const entryId = await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
      .limit(1)
      .for("update");
    const entry = existing[0];
    if (entry === undefined) throw new Error("Entry not found");

    const startedAt = patch.startedAt ?? entry.startedAt;
    const endedAt = patch.endedAt ?? entry.endedAt;
    const effectiveEnd = endedAt ?? now;
    if (effectiveEnd.getTime() <= startedAt.getTime()) {
      throw new Error("End time must be after start time");
    }
    if (patch.categoryId !== undefined) {
      await assertCategoryExists(tx, patch.categoryId);
    }
    const categoryId = patch.categoryId ?? entry.categoryId;

    // Setting an end on a running entry completes it.
    let { status, pausedAt, pausedSeconds } = entry;
    if (status !== "completed" && patch.endedAt !== undefined) {
      pausedSeconds = accumulatePause(entry, patch.endedAt);
      status = "completed";
      pausedAt = null;
    }

    let taskId = entry.taskId;
    if (patch.taskName !== undefined) {
      const task = await upsertTask(
        tx,
        userId,
        patch.taskName,
        categoryId,
        now,
      );
      taskId = task.id;
    }

    const { entries, taskNamesById } = await fetchEntriesInRange(
      tx,
      userId,
      startedAt,
      effectiveEnd,
      entry.id,
    );
    let candidateTaskName = patch.taskName;
    if (candidateTaskName === undefined) {
      const taskRows = await tx
        .select({ name: tasks.name })
        .from(tasks)
        .where(eq(tasks.id, entry.taskId))
        .limit(1);
      candidateTaskName = taskRows[0]?.name;
    }
    validateNoOverlap(
      {
        id: entry.id,
        taskName: candidateTaskName,
        startedAt,
        endedAt: effectiveEnd,
      },
      entries,
      taskNamesById,
      timeZone,
      now,
    );

    await tx
      .update(timeEntries)
      .set({
        taskId,
        categoryId,
        startedAt,
        endedAt,
        notes: patch.notes !== undefined ? patch.notes : entry.notes,
        status,
        pausedAt,
        pausedSeconds,
        updatedAt: now,
      })
      .where(eq(timeEntries.id, entry.id));

    const oldDay = zonedDayKey(entry.startedAt, timeZone);
    const newDay = zonedDayKey(startedAt, timeZone);
    const changedDays = oldDay === newDay ? [oldDay] : [oldDay, newDay];
    for (const day of changedDays) {
      await markDayChanged(tx, userId, day);
    }
    await expandAttendanceBounds(
      tx,
      userId,
      newDay,
      { startedAt, endedAt: effectiveEnd },
      false,
      newDay === todayKey(timeZone),
    );
    return entry.id;
  });
  return requireEntryDto(userId, entryId);
}

/** Delete an entry; its day is flagged changed if it was synced. */
export async function deleteEntry(
  userId: string,
  id: string,
  timeZone: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
      .limit(1)
      .for("update");
    const entry = existing[0];
    if (entry === undefined) throw new Error("Entry not found");
    await tx.delete(timeEntries).where(eq(timeEntries.id, entry.id));
    await markDayChanged(tx, userId, zonedDayKey(entry.startedAt, timeZone));
  });
}

export interface CreateTaskInput {
  name: string;
  categoryId: string;
  status?: TaskStatus;
  description?: string | null;
  isFavorite?: boolean;
}

export interface UpdateTaskInput {
  name?: string;
  categoryId?: string;
  status?: TaskStatus;
  description?: string | null;
  isFavorite?: boolean;
}

/** Create a new task directly (e.g. from Kanban). */
export async function createTask(
  userId: string,
  input: CreateTaskInput,
): Promise<TaskDTO> {
  await assertCategoryExists(db, input.categoryId);
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("Task name cannot be empty");

  const [created] = await db
    .insert(tasks)
    .values({
      userId,
      name: trimmed,
      categoryId: input.categoryId,
      status: input.status ?? "todo",
      description: input.description ?? null,
      isFavorite: input.isFavorite ?? false,
      lastUsedAt: new Date(),
    })
    .returning();

  const [cat] = await db
    .select({ key: categories.key, name: categories.name })
    .from(categories)
    .where(eq(categories.id, created.categoryId))
    .limit(1);

  return {
    id: created.id,
    name: created.name,
    categoryId: created.categoryId,
    categoryKey: cat?.key,
    categoryName: cat?.name,
    status: (created.status as TaskStatus) || "todo",
    description: created.description ?? null,
    isFavorite: created.isFavorite,
    lastUsedAt: created.lastUsedAt ? created.lastUsedAt.toISOString() : null,
    createdAt: created.createdAt.toISOString(),
  };
}

/** Update an existing task's name, category, status, or favorite state. */
export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<TaskDTO> {
  const existingRows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) throw new Error("Task not found");

  if (input.categoryId) {
    await assertCategoryExists(db, input.categoryId);
  }

  const [updated] = await db
    .update(tasks)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
      lastUsedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning();

  const [cat] = await db
    .select({ key: categories.key, name: categories.name })
    .from(categories)
    .where(eq(categories.id, updated.categoryId))
    .limit(1);

  return {
    id: updated.id,
    name: updated.name,
    categoryId: updated.categoryId,
    categoryKey: cat?.key,
    categoryName: cat?.name,
    status: (updated.status as TaskStatus) || "todo",
    description: updated.description ?? null,
    isFavorite: updated.isFavorite,
    lastUsedAt: updated.lastUsedAt ? updated.lastUsedAt.toISOString() : null,
    createdAt: updated.createdAt.toISOString(),
  };
}

/** Delete a task. */
export async function deleteTask(
  userId: string,
  taskId: string,
): Promise<boolean> {
  const result = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });

  return result.length > 0;
}

