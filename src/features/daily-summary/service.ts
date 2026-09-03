/**
 * Daily summary service — loads one local day's rows from the DB and
 * delegates all math to the pure domain (server-side durations only).
 */
import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";
import type { DaySummaryDTO } from "@/lib/types";
import { zonedDayEnd, zonedDayStart } from "@/lib/time";
import { db } from "@/server/db";
import {
  breakEntries,
  categories,
  dailyAttendance,
  tasks,
  timeEntries,
} from "@/server/db/schema";
import { buildDaySummary } from "./domain";

/** Thrown when review is attempted before the day is clocked out. */
export class ClockOutRequiredError extends Error {
  constructor() {
    super("Clock out first");
    this.name = "ClockOutRequiredError";
  }
}

export async function getDaySummary(
  userId: string,
  dayKey: string,
  tz: string,
): Promise<DaySummaryDTO> {
  const dayStart = zonedDayStart(dayKey, tz);
  const dayEnd = zonedDayEnd(dayKey, tz);

  const attendanceRow =
    (
      await db
        .select()
        .from(dailyAttendance)
        .where(
          and(
            eq(dailyAttendance.userId, userId),
            eq(dailyAttendance.workDate, dayKey),
          ),
        )
        .limit(1)
    )[0] ?? null;

  const breakRows = attendanceRow
    ? await db
        .select({
          id: breakEntries.id,
          startedAt: breakEntries.startedAt,
          endedAt: breakEntries.endedAt,
        })
        .from(breakEntries)
        .where(eq(breakEntries.attendanceId, attendanceRow.id))
        .orderBy(asc(breakEntries.startedAt))
    : [];

  // Entries overlapping the local day [dayStart, dayEnd]; the domain re-filters
  // with the exact half-open rule, so this is a superset pre-filter only.
  const entryRows = await db
    .select({
      id: timeEntries.id,
      taskId: timeEntries.taskId,
      taskName: tasks.name,
      categoryId: timeEntries.categoryId,
      categoryKey: categories.key,
      categoryName: categories.name,
      startedAt: timeEntries.startedAt,
      endedAt: timeEntries.endedAt,
      status: timeEntries.status,
      pausedAt: timeEntries.pausedAt,
      pausedSeconds: timeEntries.pausedSeconds,
      notes: timeEntries.notes,
      source: timeEntries.source,
    })
    .from(timeEntries)
    .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .innerJoin(categories, eq(categories.id, timeEntries.categoryId))
    .where(
      and(
        eq(timeEntries.userId, userId),
        lte(timeEntries.startedAt, dayEnd),
        or(isNull(timeEntries.endedAt), gt(timeEntries.endedAt, dayStart)),
      ),
    )
    .orderBy(asc(timeEntries.startedAt));

  const categoryRows = await db
    .select({
      id: categories.id,
      key: categories.key,
      name: categories.name,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder));

  return buildDaySummary({
    workDate: dayKey,
    tz,
    attendance: attendanceRow
      ? {
          id: attendanceRow.id,
          clockInAt: attendanceRow.clockInAt,
          clockOutAt: attendanceRow.clockOutAt,
          status: attendanceRow.status,
        }
      : null,
    breaks: breakRows,
    entries: entryRows,
    categories: categoryRows,
    reviewStateStored: attendanceRow?.reviewState ?? "draft",
    now: new Date(),
  });
}

/** Mark a clocked-out day as reviewed; warnings are acknowledged, not blocking. */
export async function setReviewed(
  userId: string,
  dayKey: string,
  _tz: string,
): Promise<{ reviewState: "reviewed" }> {
  const attendanceRow =
    (
      await db
        .select()
        .from(dailyAttendance)
        .where(
          and(
            eq(dailyAttendance.userId, userId),
            eq(dailyAttendance.workDate, dayKey),
          ),
        )
        .limit(1)
    )[0] ?? null;

  if (!attendanceRow || attendanceRow.status !== "closed") {
    throw new ClockOutRequiredError();
  }

  const now = new Date();
  await db
    .update(dailyAttendance)
    .set({ reviewState: "reviewed", reviewedAt: now, updatedAt: now })
    .where(eq(dailyAttendance.id, attendanceRow.id));

  return { reviewState: "reviewed" };
}
