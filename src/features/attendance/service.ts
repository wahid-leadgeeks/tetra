/**
 * Attendance service — thin DB operations around the pure domain.
 * Invariants enforced here:
 * - at most one open attendance per user (globally, enforced via query)
 * - one attendance row per user per workDate (DB unique constraint)
 * - at most one open break at a time
 * Durations are always computed server-side from stored timestamps.
 */
import { and, eq, gte, inArray, isNull, lte, ne, or } from "drizzle-orm";
import { accumulatePause } from "@/features/activities/entry-helpers";
import { todayKey, zonedDayEnd, zonedDayStart } from "@/lib/time";
import type { AttendanceDTO, BreakDTO } from "@/lib/types";
import { db } from "@/server/db";
import { breakEntries, dailyAttendance, timeEntries } from "@/server/db/schema";
import { hasBreakOverlap, isOpenBreak, toAttendanceDTO, toBreakDTO } from "./domain";

export type TxOrDb = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

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
 * Expands dailyAttendance for the given day to envelope the specified interval.
 * - Expands clockInAt earlier if startedAt < clockInAt.
 * - Expands clockOutAt later if clockOutAt is non-null and endedAt > clockOutAt.
 * - Flags reviewState as "changed_after_sync" if attendance was already synced.
 * - Creates attendance row if no attendance exists and createIfMissing is true.
 */
export async function expandAttendanceBounds(
  txOrDb: TxOrDb,
  userId: string,
  workDate: string,
  interval: { startedAt?: Date; endedAt?: Date },
  createIfMissing = false,
  isToday = false,
): Promise<void> {
  const rows = await txOrDb
    .select()
    .from(dailyAttendance)
    .where(
      and(
        eq(dailyAttendance.userId, userId),
        eq(dailyAttendance.workDate, workDate),
      ),
    )
    .limit(1);

  const existing = rows[0];
  const now = new Date();

  if (!existing) {
    if (!createIfMissing || !interval.startedAt) return;
    const clockInAt = interval.startedAt;
    const clockOutAt = isToday ? null : (interval.endedAt ?? interval.startedAt);
    const status = isToday ? "open" : "closed";
    await txOrDb.insert(dailyAttendance).values({
      userId,
      workDate,
      clockInAt,
      clockOutAt,
      status,
      reviewState: isToday ? "draft" : "ready",
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  const updates: Partial<typeof dailyAttendance.$inferInsert> = {};

  if (interval.startedAt && interval.startedAt.getTime() < existing.clockInAt.getTime()) {
    updates.clockInAt = interval.startedAt;
  }

  if (
    interval.endedAt &&
    existing.clockOutAt !== null &&
    interval.endedAt.getTime() > existing.clockOutAt.getTime()
  ) {
    updates.clockOutAt = interval.endedAt;
  }

  if (existing.reviewState === "synced" && Object.keys(updates).length > 0) {
    updates.reviewState = "changed_after_sync";
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = now;
    await txOrDb
      .update(dailyAttendance)
      .set(updates)
      .where(eq(dailyAttendance.id, existing.id));
  }
}

/**
 * Clock out: closes the open attendance. A break cannot outlive the shift,
 * so any open break is closed at clock-out time.
 * Running tasks are completed at clock-out time.
 * Attendance boundaries are guaranteed to envelope all task and break entries.
 * Throws "Not clocked in" when there is no open attendance.
 */
export async function clockOut(
  userId: string,
  timezone: string,
): Promise<AttendanceDTO> {
  const open = await findOpenAttendance(userId);
  if (open === null) {
    throw new Error("Not clocked in");
  }
  const now = new Date();

  // 1. Close any open breaks
  await db
    .update(breakEntries)
    .set({ endedAt: now })
    .where(
      and(
        eq(breakEntries.attendanceId, open.id),
        isNull(breakEntries.endedAt),
      ),
    );

  // 2. Complete any active or paused tasks so work doesn't run past clock-out
  const running = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, userId),
        inArray(timeEntries.status, ["active", "paused"]),
      ),
    );

  for (const entry of running) {
    await db
      .update(timeEntries)
      .set({
        endedAt: now,
        status: "completed",
        pausedAt: null,
        pausedSeconds: accumulatePause(entry, now),
        updatedAt: now,
      })
      .where(eq(timeEntries.id, entry.id));
  }

  // 3. Find latest completed entries / breaks for this day to guarantee clockOutAt envelopes them
  const dayStart = zonedDayStart(open.workDate, timezone);
  const dayEnd = zonedDayEnd(open.workDate, timezone);

  const dayEntries = await db
    .select({ startedAt: timeEntries.startedAt, endedAt: timeEntries.endedAt })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, userId),
        gte(timeEntries.startedAt, dayStart),
        lte(timeEntries.startedAt, dayEnd),
      ),
    );

  const dayBreaks = await db
    .select({ startedAt: breakEntries.startedAt, endedAt: breakEntries.endedAt })
    .from(breakEntries)
    .where(eq(breakEntries.attendanceId, open.id));

  let effectiveClockIn = open.clockInAt;
  let effectiveClockOut = now;

  for (const e of dayEntries) {
    if (e.startedAt.getTime() < effectiveClockIn.getTime()) {
      effectiveClockIn = e.startedAt;
    }
    if (e.endedAt && e.endedAt.getTime() > effectiveClockOut.getTime()) {
      effectiveClockOut = e.endedAt;
    }
  }

  for (const b of dayBreaks) {
    if (b.startedAt.getTime() < effectiveClockIn.getTime()) {
      effectiveClockIn = b.startedAt;
    }
    if (b.endedAt && b.endedAt.getTime() > effectiveClockOut.getTime()) {
      effectiveClockOut = b.endedAt;
    }
  }

  const updated = await db
    .update(dailyAttendance)
    .set({
      clockInAt: effectiveClockIn,
      clockOutAt: effectiveClockOut,
      status: "closed",
      updatedAt: now,
    })
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
  await db.transaction(async (tx) => {
    // Auto-pause any active task while on break so the task timer stops counting
    await tx
      .update(timeEntries)
      .set({ status: "paused", pausedAt: now, updatedAt: now })
      .where(
        and(
          eq(timeEntries.userId, userId),
          eq(timeEntries.status, "active"),
        ),
      );

    await tx
      .insert(breakEntries)
      .values({ userId, attendanceId: open.id, startedAt: now });
  });
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

/**
 * Creates a manual break for a specific workDate (timeline backfill / gap fill).
 * Automatically associates with the day's attendance (creating it if absent).
 */
export async function createManualBreak(
  userId: string,
  _timeZone: string,
  input: {
    workDate: string;
    startedAt: Date;
    endedAt: Date;
  },
): Promise<BreakDTO> {
  if (input.endedAt.getTime() <= input.startedAt.getTime()) {
    throw new Error("End time must be after start time");
  }

  // Find or create daily attendance for this workDate
  let attendance = (
    await db
      .select()
      .from(dailyAttendance)
      .where(
        and(
          eq(dailyAttendance.userId, userId),
          eq(dailyAttendance.workDate, input.workDate),
        ),
      )
      .limit(1)
  )[0];

  if (!attendance) {
    const [created] = await db
      .insert(dailyAttendance)
      .values({
        userId,
        workDate: input.workDate,
        clockInAt: input.startedAt,
        clockOutAt: input.endedAt,
        status: "closed",
        reviewState: "ready",
      })
      .returning();
    attendance = created;
  } else {
    // If break starts before clock-in or ends after clock-out, adjust clock times
    const updates: Partial<typeof dailyAttendance.$inferInsert> = {};
    if (input.startedAt.getTime() < attendance.clockInAt.getTime()) {
      updates.clockInAt = input.startedAt;
    }
    if (attendance.clockOutAt && input.endedAt.getTime() > attendance.clockOutAt.getTime()) {
      updates.clockOutAt = input.endedAt;
    }
    if (attendance.reviewState === "synced") {
      updates.reviewState = "changed_after_sync";
    }
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await db
        .update(dailyAttendance)
        .set(updates)
        .where(eq(dailyAttendance.id, attendance.id));
    }
  }

  // Validate no overlap with existing breaks on this attendance
  const existingBreaks = await db
    .select()
    .from(breakEntries)
    .where(eq(breakEntries.attendanceId, attendance.id));

  if (
    hasBreakOverlap(
      { startedAt: input.startedAt, endedAt: input.endedAt },
      existingBreaks,
    )
  ) {
    throw new Error("Break overlaps with an existing break");
  }

  const [inserted] = await db
    .insert(breakEntries)
    .values({
      userId,
      attendanceId: attendance.id,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
    })
    .returning();

  return toBreakDTO({
    id: inserted.id,
    startedAt: inserted.startedAt,
    endedAt: inserted.endedAt,
  });
}

/**
 * Updates a break entry's time span.
 */
export async function updateBreak(
  userId: string,
  breakId: string,
  _timeZone: string,
  patch: {
    startedAt?: Date;
    endedAt?: Date;
  },
): Promise<BreakDTO> {
  const [existing] = await db
    .select()
    .from(breakEntries)
    .where(and(eq(breakEntries.id, breakId), eq(breakEntries.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new Error("Break not found");
  }

  const newStart = patch.startedAt ?? existing.startedAt;
  const newEnd = patch.endedAt !== undefined ? patch.endedAt : existing.endedAt;

  if (newEnd && newEnd.getTime() <= newStart.getTime()) {
    throw new Error("End time must be after start time");
  }

  // Check overlap with other breaks on same attendance
  const otherBreaks = await db
    .select()
    .from(breakEntries)
    .where(
      and(
        eq(breakEntries.attendanceId, existing.attendanceId),
        ne(breakEntries.id, breakId),
      ),
    );

  if (
    newEnd &&
    hasBreakOverlap({ startedAt: newStart, endedAt: newEnd }, otherBreaks)
  ) {
    throw new Error("Break overlaps with an existing break");
  }

  const [updated] = await db
    .update(breakEntries)
    .set({
      startedAt: newStart,
      endedAt: newEnd,
    })
    .where(eq(breakEntries.id, breakId))
    .returning();

  // Also ensure attendance envelopes the updated break
  if (existing.attendanceId) {
    const [att] = await db
      .select()
      .from(dailyAttendance)
      .where(eq(dailyAttendance.id, existing.attendanceId))
      .limit(1);
    if (att) {
      const updates: Partial<typeof dailyAttendance.$inferInsert> = {};
      if (newStart.getTime() < att.clockInAt.getTime()) {
        updates.clockInAt = newStart;
      }
      if (att.clockOutAt && newEnd && newEnd.getTime() > att.clockOutAt.getTime()) {
        updates.clockOutAt = newEnd;
      }
      if (att.reviewState === "synced" && Object.keys(updates).length > 0) {
        updates.reviewState = "changed_after_sync";
      }
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        await db
          .update(dailyAttendance)
          .set(updates)
          .where(eq(dailyAttendance.id, att.id));
      }
    }
  }

  // Mark attendance changed_after_sync if needed
  await db
    .update(dailyAttendance)
    .set({ reviewState: "changed_after_sync", updatedAt: new Date() })
    .where(
      and(
        eq(dailyAttendance.id, existing.attendanceId),
        eq(dailyAttendance.reviewState, "synced"),
      ),
    );

  return toBreakDTO({
    id: updated.id,
    startedAt: updated.startedAt,
    endedAt: updated.endedAt,
  });
}

/**
 * Deletes a break entry.
 */
export async function deleteBreak(
  userId: string,
  breakId: string,
  _timeZone: string,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(breakEntries)
    .where(and(eq(breakEntries.id, breakId), eq(breakEntries.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new Error("Break not found");
  }

  await db.delete(breakEntries).where(eq(breakEntries.id, breakId));

  // Mark attendance changed_after_sync if needed
  await db
    .update(dailyAttendance)
    .set({ reviewState: "changed_after_sync", updatedAt: new Date() })
    .where(
      and(
        eq(dailyAttendance.id, existing.attendanceId),
        eq(dailyAttendance.reviewState, "synced"),
      ),
    );
}
