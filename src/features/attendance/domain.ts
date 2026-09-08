/**
 * Attendance domain — pure calculation and DTO mapping, no DB access.
 * All durations are whole minutes computed server-side from stored
 * timestamps (ADR-0007, ARCHITECTURE.md "Time handling").
 */
import { minutesBetween } from "@/lib/time";
import type { AttendanceDTO, AttendanceStatus, BreakDTO } from "@/lib/types";

/** Minimal break shape the domain consumes (matches break_entries rows). */
export interface BreakInput {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
}

/** Minimal daily_attendance shape the domain consumes. */
export interface AttendanceInput {
  id: string;
  workDate: string;
  clockInAt: Date;
  clockOutAt: Date | null;
  status: AttendanceStatus;
}

/** Totals for a day (DaySummaryDTO.totals is derived from these). */
export interface AttendanceTotals {
  attendanceMinutes: number;
  breakMinutes: number;
}

/**
 * Attendance and break minutes for one attendance row.
 * - While still clocked in, attendance counts until `now`.
 * - An open break counts until `now` (or clock-out, so a break can never
 *   outlive the shift).
 */
export function attendanceTotals(
  span: { clockInAt: Date; clockOutAt: Date | null },
  breaks: readonly BreakInput[],
  now: Date,
): AttendanceTotals {
  const end = span.clockOutAt ?? now;
  const attendanceMinutes = minutesBetween(span.clockInAt, end);
  let breakMinutes = 0;
  for (const b of breaks) {
    breakMinutes += minutesBetween(b.startedAt, b.endedAt ?? end);
  }
  return { attendanceMinutes, breakMinutes };
}

/** True when at least one break has no end yet (the "Already on break" guard). */
export function isOpenBreak(breaks: readonly BreakInput[]): boolean {
  return breaks.some((b) => b.endedAt === null);
}

/** Map a break row to its DTO. Open breaks carry a null duration. */
export function toBreakDTO(b: BreakInput): BreakDTO {
  return {
    id: b.id,
    startedAt: b.startedAt.toISOString(),
    endedAt: b.endedAt?.toISOString() ?? null,
    durationMinutes:
      b.endedAt === null ? null : minutesBetween(b.startedAt, b.endedAt),
  };
}

/**
 * Map an attendance row plus its breaks to AttendanceDTO.
 * Breaks are returned sorted by start time; `breakMinutes` includes the
 * open break counted until `now`.
 */
export function toAttendanceDTO(
  row: AttendanceInput,
  breaks: readonly BreakInput[],
  now: Date,
): AttendanceDTO {
  const { breakMinutes } = attendanceTotals(row, breaks, now);
  const sorted = [...breaks].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );
  const activeBreak = sorted.find((b) => b.endedAt === null) ?? null;
  return {
    id: row.id,
    workDate: row.workDate,
    clockInAt: row.clockInAt.toISOString(),
    clockOutAt: row.clockOutAt?.toISOString() ?? null,
    status: row.status,
    activeBreak: activeBreak === null ? null : toBreakDTO(activeBreak),
    breaks: sorted.map(toBreakDTO),
    breakMinutes,
  };
}

/**
 * Checks whether a candidate break overlaps with any existing breaks.
 * Half-open interval [startedAt, endedAt). Adjacent intervals do not overlap.
 */
export function hasBreakOverlap(
  candidate: { startedAt: Date; endedAt: Date },
  breaks: readonly BreakInput[],
  options?: { excludeId?: string; now?: Date },
): boolean {
  const now = options?.now ?? new Date();
  for (const b of breaks) {
    if (options?.excludeId && b.id === options.excludeId) continue;
    const bEnd = b.endedAt ?? now;
    if (
      candidate.startedAt.getTime() < bEnd.getTime() &&
      candidate.endedAt.getTime() > b.startedAt.getTime()
    ) {
      return true;
    }
  }
  return false;
}

