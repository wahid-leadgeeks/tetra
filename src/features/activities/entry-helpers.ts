/**
 * Shared internal helpers for the activities service modules.
 * Not part of the public service API (re-exported nowhere).
 */
import { and, eq, gt, isNull, lt, ne, or } from "drizzle-orm";
import type { TimeEntryDTO } from "@/lib/types";
import type { TimeEntryCore } from "./domain";
import { toTimeEntryDTO } from "./domain";
import { db } from "@/server/db";
import {
  categories,
  dailyAttendance,
  tasks,
  timeEntries,
} from "@/server/db/schema";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function entryWithTaskCategory() {
  return db
    .select({ entry: timeEntries, task: tasks, category: categories })
    .from(timeEntries)
    .innerJoin(tasks, eq(timeEntries.taskId, tasks.id))
    .innerJoin(categories, eq(timeEntries.categoryId, categories.id));
}

export async function requireEntryDto(
  userId: string,
  entryId: string,
): Promise<TimeEntryDTO> {
  const now = new Date();
  const rows = await entryWithTaskCategory()
    .where(and(eq(timeEntries.userId, userId), eq(timeEntries.id, entryId)))
    .limit(1);
  const row = rows[0];
  if (row === undefined) throw new Error("Entry not found");
  return toTimeEntryDTO(row.entry, row.task, row.category, now);
}

/** Paused seconds accumulated up to `at` (open pause included, clamped ≥ 0). */
export function accumulatePause(entry: TimeEntryCore, at: Date): number {
  if (entry.status !== "paused" || entry.pausedAt === null) {
    return entry.pausedSeconds;
  }
  const seconds = Math.max(
    0,
    Math.floor((at.getTime() - entry.pausedAt.getTime()) / 1000),
  );
  return entry.pausedSeconds + seconds;
}

export async function assertCategoryExists(
  tx: Tx,
  categoryId: string,
): Promise<void> {
  const rows = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  if (rows.length === 0) throw new Error("Unknown category");
}

/** Find-or-create the user's task; refreshes category + lastUsedAt. */
export async function upsertTask(
  tx: Tx,
  userId: string,
  taskName: string,
  categoryId: string,
  now: Date,
) {
  const rows = await tx
    .insert(tasks)
    .values({ userId, name: taskName, categoryId, lastUsedAt: now })
    .onConflictDoUpdate({
      target: [tasks.userId, tasks.name],
      set: { categoryId, lastUsedAt: now },
    })
    .returning();
  const task = rows[0];
  if (task === undefined) throw new Error("Failed to save task");
  return task;
}

/** A synced day becomes `changed_after_sync` once its entries change. */
export async function markDayChanged(
  tx: Tx,
  userId: string,
  dayKey: string,
): Promise<void> {
  await tx
    .update(dailyAttendance)
    .set({ reviewState: "changed_after_sync", updatedAt: new Date() })
    .where(
      and(
        eq(dailyAttendance.userId, userId),
        eq(dailyAttendance.workDate, dayKey),
        eq(dailyAttendance.reviewState, "synced"),
      ),
    );
}

/** Entries whose [startedAt, endedAt) range intersects [rangeStart, rangeEnd). */
export async function fetchEntriesInRange(
  tx: Tx,
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
  excludeEntryId?: string,
): Promise<{
  entries: TimeEntryCore[];
  taskNamesById: Map<string, string>;
}> {
  const conditions = [
    eq(timeEntries.userId, userId),
    lt(timeEntries.startedAt, rangeEnd),
    or(isNull(timeEntries.endedAt), gt(timeEntries.endedAt, rangeStart)),
  ];
  if (excludeEntryId !== undefined) {
    conditions.push(ne(timeEntries.id, excludeEntryId));
  }
  const rows = await tx
    .select({ entry: timeEntries, taskName: tasks.name })
    .from(timeEntries)
    .innerJoin(tasks, eq(timeEntries.taskId, tasks.id))
    .where(and(...conditions));
  return {
    entries: rows.map((row) => row.entry),
    taskNamesById: new Map(
      rows.map((row) => [row.entry.taskId, row.taskName] as const),
    ),
  };
}
