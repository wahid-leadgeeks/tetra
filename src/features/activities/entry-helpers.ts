/**
 * Shared internal helpers for the activities service modules.
 * Not part of the public service API (re-exported nowhere).
 */
import { and, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { zonedDayEnd, zonedDayKey } from "@/lib/time";
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
  client: Tx | typeof db,
  categoryId: string,
): Promise<void> {
  const rows = await client
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
    .values({
      userId,
      name: taskName,
      categoryId,
      status: "in_progress",
      startedAt: now,
      lastUsedAt: now,
    })
    .onConflictDoUpdate({
      target: [tasks.userId, tasks.name],
      set: {
        categoryId,
        status: sql`CASE WHEN ${tasks.status} IN ('todo', 'backlog') THEN 'in_progress' ELSE ${tasks.status} END`,
        startedAt: sql`COALESCE(${tasks.startedAt}, excluded.started_at)`,
        lastUsedAt: now,
      },
    })
    .returning();
  const task = rows[0];
  if (task === undefined) throw new Error("Failed to save task");
  return task;
}

/**
 * Every local day key touched by the entry range `[start, end ?? now)`.
 * Always contains at least the start day.
 */
export function entryDayKeys(
  start: Date,
  end: Date | null,
  timeZone: string,
  now: Date = new Date(),
): string[] {
  const firstKey = zonedDayKey(start, timeZone);
  const effectiveEnd = end ?? now;
  const keys = [firstKey];
  if (effectiveEnd.getTime() <= start.getTime()) return keys;
  const lastKey = zonedDayKey(
    new Date(effectiveEnd.getTime() - 1),
    timeZone,
  );
  let key = firstKey;
  while (key < lastKey) {
    key = zonedDayKey(
      new Date(zonedDayEnd(key, timeZone).getTime() + 1),
      timeZone,
    );
    keys.push(key);
  }
  return keys;
}

/**
 * Record that the given days changed: always bumps
 * `daily_attendance.updated_at` (the "last change" timestamp compared with
 * `last_synced_at`), and moves a `synced` day to `changed_after_sync`.
 * Days without an attendance row are untouched.
 */
export async function markDaysChanged(
  tx: Tx,
  userId: string,
  dayKeys: string[],
): Promise<void> {
  const unique = [...new Set(dayKeys)];
  if (unique.length === 0) return;
  await tx
    .update(dailyAttendance)
    .set({
      updatedAt: new Date(),
      reviewState: sql`CASE WHEN ${dailyAttendance.reviewState} = 'synced' THEN 'changed_after_sync'::review_state ELSE ${dailyAttendance.reviewState} END`,
    })
    .where(
      and(
        eq(dailyAttendance.userId, userId),
        inArray(dailyAttendance.workDate, unique),
      ),
    );
}

/** Single-day form of {@link markDaysChanged} (always bumps `updated_at`). */
export async function markDayChanged(
  tx: Tx,
  userId: string,
  dayKey: string,
): Promise<void> {
  await markDaysChanged(tx, userId, [dayKey]);
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
