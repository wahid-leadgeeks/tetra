/**
 * Daily summary domain — pure aggregation for the day review screen (ADR-0007:
 * UTC storage, user-timezone day grouping). No DB, no clock, no other features:
 * everything arrives as input, so the whole day computes deterministically.
 */
import type {
  BreakDTO,
  CategoryTotalDTO,
  DaySummaryDTO,
  DayWarning,
  ReviewState,
  TimeEntryDTO,
} from "@/lib/types";
import { minutesBetween, zonedClock, zonedDayEnd, zonedDayStart } from "@/lib/time";
import type {
  BuildDaySummaryInput,
  DaySummaryAttendanceInput,
  DaySummaryEntryInput,
} from "./types";

/** Gaps between consecutive entries above this many minutes are flagged. */
const GAP_THRESHOLD_MINUTES = 5;

/**
 * Wall-clock end of an entry's occupied interval: endedAt when completed,
 * pausedAt while paused, otherwise now (still running).
 */
function intervalEnd(entry: DaySummaryEntryInput, now: Date): Date {
  if (entry.endedAt) return entry.endedAt;
  if (entry.status === "paused" && entry.pausedAt) return entry.pausedAt;
  return now;
}

/**
 * Duration per spec: (endedAt ?? now − startedAt) − pausedSeconds − live pause span.
 * Elapsed runs to now while open — unlike intervalEnd, which uses pausedAt.
 */
function entryDurationMinutes(entry: DaySummaryEntryInput, now: Date): number {
  const elapsed = (entry.endedAt ?? now).getTime() - entry.startedAt.getTime();
  const pausedMs =
    entry.pausedSeconds * 1000 +
    (entry.status === "paused" && entry.pausedAt
      ? now.getTime() - entry.pausedAt.getTime()
      : 0);
  return Math.max(0, Math.floor((elapsed - pausedMs) / 60_000));
}

/**
 * Half-open [aStart,aEnd) ∩ [bStart,bEnd): adjacent intervals do not overlap.
 * The four parameters are the endpoints of the two intervals under test.
 */
function intervalsIntersect(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/** Overlap warnings for every intersecting entry pair, chronological order. */
function overlapWarnings(
  dayEntries: DaySummaryEntryInput[],
  now: Date,
  tz: string,
): DayWarning[] {
  const clock = (d: Date) => zonedClock(d, tz);
  const warnings: DayWarning[] = [];
  for (let i = 0; i < dayEntries.length; i++) {
    for (let j = i + 1; j < dayEntries.length; j++) {
      const a = dayEntries[i];
      const b = dayEntries[j];
      if (a === undefined || b === undefined) continue;
      const aEnd = intervalEnd(a, now);
      const bEnd = intervalEnd(b, now);
      if (!intervalsIntersect(a.startedAt, aEnd, b.startedAt, bEnd)) continue;
      warnings.push({
        type: "overlap",
        message: `Two activities overlap: ${a.taskName} ${clock(a.startedAt)}–${clock(aEnd)} / ${b.taskName} ${clock(b.startedAt)}–${clock(bEnd)}`,
        entryIds: [a.id, b.id],
      });
    }
  }
  return warnings;
}

/**
 * Gap warnings between consecutive entries, clamped to the attendance window.
 * Spans at the window edges (clock-in → first task, last task → clock-out)
 * are not "between" entries and never count.
 */
function gapWarnings(
  dayEntries: DaySummaryEntryInput[],
  attendance: DaySummaryAttendanceInput,
  now: Date,
): DayWarning[] {
  const windowStart = attendance.clockInAt;
  const windowEnd = attendance.clockOutAt ?? now;
  const warnings: DayWarning[] = [];
  for (let i = 0; i + 1 < dayEntries.length; i++) {
    const prev = dayEntries[i];
    const next = dayEntries[i + 1];
    if (prev === undefined || next === undefined) continue;
    const from = Math.max(intervalEnd(prev, now).getTime(), windowStart.getTime());
    const to = Math.min(next.startedAt.getTime(), windowEnd.getTime());
    const minutes = minutesBetween(new Date(from), new Date(to));
    if (minutes > GAP_THRESHOLD_MINUTES) {
      warnings.push({
        type: "gap",
        minutes,
        message: `${minutes}m gap between ${prev.taskName} and ${next.taskName}`,
      });
    }
  }
  return warnings;
}

function deriveReviewState(
  stored: ReviewState,
  attendance: DaySummaryAttendanceInput | null,
  warnings: DayWarning[],
): ReviewState {
  if (stored !== "draft") return stored;
  const closedCleanDay =
    attendance !== null && attendance.status === "closed" && warnings.length === 0;
  return closedCleanDay ? "ready" : "draft";
}

/** Aggregate one local day into the DTO consumed by the review screen. */
export function buildDaySummary(input: BuildDaySummaryInput): DaySummaryDTO {
  const { workDate, tz, attendance, breaks, entries, categories, reviewStateStored, now } =
    input;

  const dayStart = zonedDayStart(workDate, tz);
  const dayEndExclusive = new Date(zonedDayEnd(workDate, tz).getTime() + 1);

  const dayEntries = entries
    .filter((e) =>
      intervalsIntersect(e.startedAt, intervalEnd(e, now), dayStart, dayEndExclusive),
    )
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

  const timedEntries = dayEntries.map((entry) => ({
    entry,
    minutes: entryDurationMinutes(entry, now),
  }));
  const workMinutes = timedEntries.reduce((sum, t) => sum + t.minutes, 0);

  const categoryMinutes = new Map<string, number>();
  for (const { entry, minutes } of timedEntries) {
    categoryMinutes.set(
      entry.categoryId,
      (categoryMinutes.get(entry.categoryId) ?? 0) + minutes,
    );
  }
  const byCategory: CategoryTotalDTO[] = [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      categoryId: c.id,
      key: c.key,
      name: c.name,
      minutes: categoryMinutes.get(c.id) ?? 0,
    }));

  const breakDtos: BreakDTO[] = breaks.map((b) => ({
    id: b.id,
    startedAt: b.startedAt.toISOString(),
    endedAt: b.endedAt?.toISOString() ?? null,
    // Null while the break is open, mirroring TimeEntryDTO's convention.
    durationMinutes: b.endedAt ? minutesBetween(b.startedAt, b.endedAt) : null,
  }));
  // Open breaks still contribute to the running total until now.
  const breakMinutes = breaks.reduce(
    (sum, b) => sum + minutesBetween(b.startedAt, b.endedAt ?? now),
    0,
  );

  const warnings: DayWarning[] = [
    ...overlapWarnings(dayEntries, now, tz),
    ...(attendance ? gapWarnings(dayEntries, attendance, now) : []),
  ];
  if (dayEntries.some((e) => e.status === "active" || e.status === "paused")) {
    warnings.push({ type: "open_task", message: "A task is still open" });
  }
  if (attendance && attendance.status === "open") {
    warnings.push({ type: "missing_clock_out", message: "Missing clock out" });
  }
  if (attendance && attendance.status === "closed" && workMinutes === 0) {
    warnings.push({ type: "no_work", message: "No work recorded" });
  }

  const timeEntryDtos: TimeEntryDTO[] = timedEntries.map(({ entry, minutes }) => ({
    id: entry.id,
    taskId: entry.taskId,
    taskName: entry.taskName,
    categoryId: entry.categoryId,
    categoryKey: entry.categoryKey,
    categoryName: entry.categoryName,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt?.toISOString() ?? null,
    status: entry.status,
    notes: entry.notes,
    source: entry.source,
    durationMinutes: entry.status === "active" ? null : minutes,
  }));

  return {
    workDate,
    attendance: attendance
      ? {
          id: attendance.id,
          workDate,
          clockInAt: attendance.clockInAt.toISOString(),
          clockOutAt: attendance.clockOutAt?.toISOString() ?? null,
          status: attendance.status,
          activeBreak: breakDtos.findLast((b) => b.endedAt === null) ?? null,
          breaks: breakDtos,
          breakMinutes,
        }
      : null,
    timeEntries: timeEntryDtos,
    totals: {
      attendanceMinutes: attendance
        ? minutesBetween(attendance.clockInAt, attendance.clockOutAt ?? now)
        : 0,
      breakMinutes,
      workMinutes,
    },
    byCategory,
    warnings,
    reviewState: deriveReviewState(reviewStateStored, attendance, warnings),
  };
}
