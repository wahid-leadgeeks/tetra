/**
 * Manual entry corrections: create, update, delete.
 * Every write re-validates overlaps server-side and flags synced days
 * as `changed_after_sync`.
 */
import { and, eq } from "drizzle-orm";
import { expandAttendanceBounds } from "@/features/attendance/service";
import { todayKey, zonedDayKey } from "@/lib/time";
import type { TaskDTO, TaskPriority, TaskStatus, TimeEntryDTO } from "@/lib/types";
import { db } from "@/server/db";
import { categories, tasks, timeEntries } from "@/server/db/schema";
import { validateNoOverlap } from "./domain";
import {
  accumulatePause,
  assertCategoryExists,
  entryDayKeys,
  fetchEntriesInRange,
  markDayChanged,
  markDaysChanged,
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

    const newDay = zonedDayKey(startedAt, timeZone);
    // Flag every local day of the old and the new range.
    await markDaysChanged(tx, userId, [
      ...new Set([
        ...entryDayKeys(entry.startedAt, entry.endedAt, timeZone, now),
        ...entryDayKeys(startedAt, effectiveEnd, timeZone, now),
      ]),
    ]);
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

/** Delete an entry; every local day it touched is flagged changed. */
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
    await markDaysChanged(
      tx,
      userId,
      entryDayKeys(entry.startedAt, entry.endedAt, timeZone),
    );
  });
}

export interface CreateTaskInput {
  name: string;
  categoryId: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  description?: string | null;
  isFavorite?: boolean;
  dueAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface UpdateTaskInput {
  name?: string;
  categoryId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  description?: string | null;
  isFavorite?: boolean;
  dueAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

/** Create a new task directly (e.g. from Kanban). */
export async function createTask(
  userId: string,
  input: CreateTaskInput,
): Promise<TaskDTO> {
  await assertCategoryExists(db, input.categoryId);
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error("Task name cannot be empty");

  const now = new Date();
  const status = input.status ?? "todo";
  const startedAt =
    input.startedAt !== undefined
      ? input.startedAt
      : status === "in_progress"
        ? now
        : null;
  const completedAt =
    input.completedAt !== undefined
      ? input.completedAt
      : status === "done"
        ? now
        : null;

  const [created] = await db
    .insert(tasks)
    .values({
      userId,
      name: trimmed,
      categoryId: input.categoryId,
      status,
      priority: input.priority ?? "medium",
      description: input.description ?? null,
      isFavorite: input.isFavorite ?? false,
      dueAt: input.dueAt ?? null,
      startedAt,
      completedAt,
      lastUsedAt: now,
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
    priority: (created.priority as TaskPriority) || "medium",
    description: created.description ?? null,
    isFavorite: created.isFavorite,
    dueAt: created.dueAt ? created.dueAt.toISOString() : null,
    startedAt: created.startedAt ? created.startedAt.toISOString() : null,
    completedAt: created.completedAt ? created.completedAt.toISOString() : null,
    lastUsedAt: created.lastUsedAt ? created.lastUsedAt.toISOString() : null,
    createdAt: created.createdAt.toISOString(),
  };
}

/** Update an existing task's name, category, status, priority, or dates. */
export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
  timeZone: string,
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

  const now = new Date();
  let completedAt = existing.completedAt;
  if (input.status !== undefined) {
    if (input.status === "done" && existing.status !== "done") {
      completedAt = input.completedAt ?? now;
    } else if (input.status !== "done" && existing.status === "done") {
      completedAt = input.completedAt ?? null;
    }
  } else if (input.completedAt !== undefined) {
    completedAt = input.completedAt;
  }

  let startedAt = existing.startedAt;
  if (input.status === "in_progress" && !existing.startedAt) {
    startedAt = input.startedAt ?? now;
  } else if (input.startedAt !== undefined) {
    startedAt = input.startedAt;
  }

  const patch = {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
    ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
    startedAt,
    completedAt,
    lastUsedAt: now,
  };

  // Only the task name and category reach the sheet (notes cells use the
  // task name; entries carry their own category). Those changes flag every
  // local day that has entries for this task; other fields skip the fan-out.
  const sheetRelevantChange =
    (input.name !== undefined && input.name.trim() !== existing.name) ||
    (input.categoryId !== undefined && input.categoryId !== existing.categoryId);

  let updated: typeof tasks.$inferSelect;
  if (sheetRelevantChange) {
    updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(tasks)
        .set(patch)
        .where(eq(tasks.id, taskId))
        .returning();
      const entries = await tx
        .select({ startedAt: timeEntries.startedAt, endedAt: timeEntries.endedAt })
        .from(timeEntries)
        .where(and(eq(timeEntries.userId, userId), eq(timeEntries.taskId, taskId)));
      await markDaysChanged(
        tx,
        userId,
        entries.flatMap((e) => entryDayKeys(e.startedAt, e.endedAt, timeZone, now)),
      );
      return row;
    });
  } else {
    [updated] = await db
      .update(tasks)
      .set(patch)
      .where(eq(tasks.id, taskId))
      .returning();
  }

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
    priority: (updated.priority as TaskPriority) || "medium",
    description: updated.description ?? null,
    isFavorite: updated.isFavorite,
    dueAt: updated.dueAt ? updated.dueAt.toISOString() : null,
    startedAt: updated.startedAt ? updated.startedAt.toISOString() : null,
    completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
    lastUsedAt: updated.lastUsedAt ? updated.lastUsedAt.toISOString() : null,
    createdAt: updated.createdAt.toISOString(),
  };
}

/**
 * Delete a task. Its entries cascade away, so every local day that had an
 * entry for the task is flagged changed.
 */
export async function deleteTask(
  userId: string,
  taskId: string,
  timeZone: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const entries = await tx
      .select({ startedAt: timeEntries.startedAt, endedAt: timeEntries.endedAt })
      .from(timeEntries)
      .where(and(eq(timeEntries.userId, userId), eq(timeEntries.taskId, taskId)));
    const result = await tx
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning({ id: tasks.id });
    await markDaysChanged(
      tx,
      userId,
      entries.flatMap((e) => entryDayKeys(e.startedAt, e.endedAt, timeZone, now)),
    );
    return result.length > 0;
  });
}

