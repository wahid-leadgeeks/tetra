/**
 * Attendance service — thin DB operations around the pure domain.
 * Invariants enforced here:
 * - at most one open attendance per user (globally, enforced via query)
 * - one attendance row per user per workDate (DB unique constraint)
 * - at most one open break at a time
 * Durations are always computed server-side from stored timestamps.
 */
import { and, eq, isNull, or } from "drizzle-orm";
import { todayKey } from "@/lib/time";
import type { AttendanceDTO } from "@/lib/types";
import { db } from "@/server/db";
import { breakEntries, dailyAttendance } from "@/server/db/schema";
import { isOpenBreak, toAttendanceDTO } from "./domain";

type AttendanceRow = typeof dailyAttendance.$inferSelect;

async function loadBreaks(attendanceId: string) {
  return db
    .select()
    .from(breakEntries)
    .where(eq(breakEntries.attendanceId, attendanceId));
}

/** Reload breaks and map the row to a fresh DTO as of `now`. */
async function refreshDTO(row: AttendanceRow, now: Date): Promise<AttendanceDTO> {
  const breaks = await loadBreaks(row.id);
  return toAttendanceDTO(row, breaks, now);
}

/** The single open attendance for a user, or null (query-enforced invariant). */
async function findOpenAttendance(userId: string): Promise<AttendanceRow | null> {
  const rows = await db
    .select()
    .from(dailyAttendance)
    .where(
      and(
        eq(dailyAttendance.userId, userId),
        eq(dailyAttendance.status, "open"),
      ),
    )
    .limit(1);
  return rows.length > 0 ? rows[0] : null;
}

/** Attendance for a specific "YYYY-MM-DD" day key, or null. */
export async function getAttendance(
  userId: string,
  dayKey: string,
): Promise<AttendanceDTO | null> {
  const rows = await db
    .select()
    .from(dailyAttendance)
    .where(
      and(
        eq(dailyAttendance.userId, userId),
        eq(dailyAttendance.workDate, dayKey),
      ),
    )
    .limit(1);
  if (rows.length === 0) return null;
  return refreshDTO(rows[0], new Date());
}

/** Attendance for today in the user's timezone, or null. */
export async function getAttendanceToday(
  userId: string,
  timezone: string,
): Promise<AttendanceDTO | null> {
  return getAttendance(userId, todayKey(timezone));
}

/**
 * Clock in: creates today's open attendance row.
 * Throws "Already clocked in" when an open attendance exists on any day,
 * or today already has an attendance row (open or closed).
 */
export async function clockIn(
  userId: string,
  timezone: string,
): Promise<AttendanceDTO> {
  const now = new Date();
  const workDate = todayKey(timezone);
  const conflict = await db
    .select({ id: dailyAttendance.id })
    .from(dailyAttendance)
    .where(
      and(
        eq(dailyAttendance.userId, userId),
        or(
          eq(dailyAttendance.status, "open"),
          eq(dailyAttendance.workDate, workDate),
        ),
      ),
    )
    .limit(1);
  if (conflict.length > 0) {
    throw new Error("Already clocked in");
  }
  const inserted = await db
    .insert(dailyAttendance)
    .values({ userId, workDate, clockInAt: now, status: "open" })
    .returning();
  return refreshDTO(inserted[0], now);
}

/**
 * Clock out: closes the open attendance. A break cannot outlive the shift,
 * so any open break is closed at clock-out time.
 * Throws "Not clocked in" when there is no open attendance.
 */
export async function clockOut(
  userId: string,
  _timezone: string,
): Promise<AttendanceDTO> {
  const open = await findOpenAttendance(userId);
  if (open === null) {
    throw new Error("Not clocked in");
  }
  const now = new Date();
  await db
    .update(breakEntries)
    .set({ endedAt: now })
    .where(
      and(
        eq(breakEntries.attendanceId, open.id),
        isNull(breakEntries.endedAt),
      ),
    );
  const updated = await db
    .update(dailyAttendance)
    .set({ clockOutAt: now, status: "closed", updatedAt: now })
    .where(eq(dailyAttendance.id, open.id))
    .returning();
  return refreshDTO(updated[0], now);
}

/**
 * Start a break on the open attendance.
 * Throws "Not clocked in" / "Already on break".
 */
export async function startBreak(
  userId: string,
  _timezone: string,
): Promise<AttendanceDTO> {
  const open = await findOpenAttendance(userId);
  if (open === null) {
    throw new Error("Not clocked in");
  }
  const now = new Date();
  const breaks = await loadBreaks(open.id);
  if (isOpenBreak(breaks)) {
    throw new Error("Already on break");
  }
  await db
    .insert(breakEntries)
    .values({ userId, attendanceId: open.id, startedAt: now });
  return refreshDTO(open, now);
}

/**
 * End the open break.
 * Throws "Not clocked in" when not clocked in, "Not on break" when no
 * break is open.
 */
export async function endBreak(
  userId: string,
  _timezone: string,
): Promise<AttendanceDTO> {
  const open = await findOpenAttendance(userId);
  if (open === null) {
    throw new Error("Not clocked in");
  }
  const now = new Date();
  const breaks = await loadBreaks(open.id);
  const openBreak = breaks.find((b) => b.endedAt === null);
  if (openBreak === undefined) {
    throw new Error("Not on break");
  }
  await db
    .update(breakEntries)
    .set({ endedAt: now })
    .where(
      and(eq(breakEntries.id, openBreak.id), isNull(breakEntries.endedAt)),
    );
  return refreshDTO(open, now);
}
