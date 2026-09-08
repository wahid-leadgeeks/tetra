import { and, asc, eq, gt, gte, inArray, isNull, lte, or } from "drizzle-orm";
import type { DaySummaryDTO } from "@/lib/types";
import { addDaysISO, zonedDayEnd, zonedDayStart } from "@/lib/time";
import { buildDaySummary } from "@/features/daily-summary/domain";
import { db } from "@/server/db";
import {
  breakEntries,
  categories,
  dailyAttendance,
  tasks,
  timeEntries,
} from "@/server/db/schema";
import { aggregateMonth, monthRange, type MonthAggregate } from "./domain";

export type MonthSummary = MonthAggregate & { from: string; to: string };

/**
 * Batch-loads day summaries for a continuous range of ISO day keys in 3-4 queries
 * instead of making N*3 sequential database round-trips.
 */
export async function getBatchDaySummaries(
  userId: string,
  dayKeys: string[],
  tz: string,
): Promise<DaySummaryDTO[]> {
  if (dayKeys.length === 0) return [];

  const from = dayKeys[0];
  const to = dayKeys[dayKeys.length - 1];
  const rangeStart = zonedDayStart(from, tz);
  const rangeEnd = zonedDayEnd(to, tz);

  const [attendanceRows, categoryRows, entryRows] = await Promise.all([
    db
      .select()
      .from(dailyAttendance)
      .where(
        and(
          eq(dailyAttendance.userId, userId),
          gte(dailyAttendance.workDate, from),
          lte(dailyAttendance.workDate, to),
        ),
      ),
    db
      .select({
        id: categories.id,
        key: categories.key,
        name: categories.name,
        sortOrder: categories.sortOrder,
      })
      .from(categories)
      .orderBy(asc(categories.sortOrder)),
    db
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
          lte(timeEntries.startedAt, rangeEnd),
          or(isNull(timeEntries.endedAt), gt(timeEntries.endedAt, rangeStart)),
        ),
      )
      .orderBy(asc(timeEntries.startedAt)),
  ]);

  const attendanceIds = attendanceRows.map((a) => a.id);
  const breakRows =
    attendanceIds.length > 0
      ? await db
          .select({
            id: breakEntries.id,
            attendanceId: breakEntries.attendanceId,
            startedAt: breakEntries.startedAt,
            endedAt: breakEntries.endedAt,
          })
          .from(breakEntries)
          .where(inArray(breakEntries.attendanceId, attendanceIds))
          .orderBy(asc(breakEntries.startedAt))
      : [];

  const attendanceByDate = new Map<string, (typeof attendanceRows)[number]>();
  for (const att of attendanceRows) {
    attendanceByDate.set(att.workDate, att);
  }

  const breaksByAttendanceId = new Map<string, typeof breakRows>();
  for (const brk of breakRows) {
    const list = breaksByAttendanceId.get(brk.attendanceId) ?? [];
    list.push(brk);
    breaksByAttendanceId.set(brk.attendanceId, list);
  }

  const now = new Date();
  return dayKeys.map((dayKey) => {
    const dayStart = zonedDayStart(dayKey, tz);
    const dayEnd = zonedDayEnd(dayKey, tz);
    const att = attendanceByDate.get(dayKey) ?? null;
    const breaks = att ? breaksByAttendanceId.get(att.id) ?? [] : [];

    const dayEntries = entryRows.filter(
      (e) =>
        e.startedAt.getTime() <= dayEnd.getTime() &&
        (e.endedAt === null || e.endedAt.getTime() > dayStart.getTime()),
    );

    return buildDaySummary({
      workDate: dayKey,
      tz,
      attendance: att
        ? {
            id: att.id,
            clockInAt: att.clockInAt,
            clockOutAt: att.clockOutAt,
            status: att.status,
          }
        : null,
      breaks,
      entries: dayEntries,
      categories: categoryRows,
      reviewStateStored: att?.reviewState ?? "draft",
      now,
    });
  });
}

/**
 * The month containing anchorDayKey: loads day summaries using high-performance
 * batch queries and aggregates with the pure domain.
 */
export async function getMonthSummary(
  userId: string,
  anchorDayKey: string,
  tz: string,
): Promise<MonthSummary> {
  const { from, to } = monthRange(anchorDayKey);

  const dayKeys: string[] = [];
  for (let dayKey = from; dayKey <= to; dayKey = addDaysISO(dayKey, 1)) {
    dayKeys.push(dayKey);
  }

  const summaries = await getBatchDaySummaries(userId, dayKeys, tz);
  return { ...aggregateMonth(summaries, { from, to }), from, to };
}

