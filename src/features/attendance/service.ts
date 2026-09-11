/**
 * Attendance service — thin DB operations around the pure domain.
 * Invariants enforced here:
 * - at most one open attendance per user (globally, enforced via query)
 * - one attendance row per user per workDate (DB unique constraint)
 * - at most one open break at a time
 * Durations are always computed server-side from stored timestamps.
 */
import { and, eq, gte, inArray, isNull, lt, lte, ne, or } from "drizzle-orm";
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

/**
 * Automatically closes any open attendance rows from previous days (workDate < todayKey).
 * Guarantees that unclosed shifts from previous days do not block tracking today.
 * Sets clockOutAt to the latest task/break end timestamp on that day (or clockInAt if none).
 */
export async function autoClosePastAttendances(
  userId: string,
  timezone: string,
): Promise<void> {
  const today = todayKey(timezone);
  const pastOpen = await db
    .select()
    .from(dailyAttendance)
    .where(
      and(
        eq(dailyAttendance.userId, userId),
        eq(dailyAttendance.status, "open"),
        lt(dailyAttendance.workDate, today),
      ),
    );

  for (const open of pastOpen) {
    const dayStart = zonedDayStart(open.workDate, timezone);
    const dayEnd = zonedDayEnd(open.workDate, timezone);

    // 1. Close any open breaks
    await db
      .update(breakEntries)
      .set({ endedAt: dayEnd })
      .where(
        and(
          eq(breakEntries.attendanceId, open.id),
          isNull(breakEntries.endedAt),
        ),
      );

    // 2. Complete active/paused tasks from that day
    await db
      .update(timeEntries)
      .set({
        status: "completed",
        endedAt: dayEnd,
        pausedAt: null,
      })
      .where(
        and(
          eq(timeEntries.userId, userId),
          inArray(timeEntries.status, ["active", "paused"]),
          gte(timeEntries.startedAt, dayStart),
          lte(timeEntries.startedAt, dayEnd),
        ),
      );

    // 3. Find latest task or break end to set effective clockOutAt
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
    let effectiveClockOut = open.clockInAt;

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

    await db
      .update(dailyAttendance)
      .set({
        clockInAt: effectiveClockIn,
        clockOutAt: effectiveClockOut,
        status: "closed",
        updatedAt: new Date(),
      })
      .where(eq(dailyAttendance.id, open.id));
  }
}

/** Attendance for today in the user's timezone, or null. */
export async function getAttendanceToday(
  userId: string,
  timezone: string,
): Promise<AttendanceDTO | null> {
  await autoClosePastAttendances(userId, timezone);
  return getAttendance(userId, todayKey(timezone));
}

/**
 * Clock in: creates today's open attendance row.
 * Automatically closes any unclosed attendance from previous days.
 * Throws "Already clocked in" when today already has an attendance row (open or closed).
 */
export async function clockIn(
  userId: string,
  timezone: string,
): Promise<AttendanceDTO> {
  const now = new Date();
  const workDate = todayKey(timezone);

  // Auto-close any lingering unclosed shifts from previous days
  await autoClosePastAttendances(userId, timezone);

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

export interface UpdateAttendanceInput {
  clockInAt?: Date | string | null;
  clockOutAt?: Date | string | null;
  status?: "open" | "closed";
  action?: "clock_in" | "clock_out" | "update";
}

/**
 * Updates or creates attendance times (clock-in, clock-out, status) for a given workDate.
 * Auto-envelopes all day's tasks and breaks, auto-closes open breaks and active tasks on clock-out.
 */
export async function updateAttendanceTimes(
  userId: string,
  workDate: string,
  timezone: string,
  input: UpdateAttendanceInput,
): Promise<AttendanceDTO> {
  const dayStart = zonedDayStart(workDate, timezone);
  const dayEnd = zonedDayEnd(workDate, timezone);
  const now = new Date();

  // Find existing attendance
  const existingRows = await db
    .select()
    .from(dailyAttendance)
    .where(
      and(
        eq(dailyAttendance.userId, userId),
        eq(dailyAttendance.workDate, workDate),
      ),
    )
    .limit(1);

  const existing = existingRows[0] ?? null;

  // Query entries and breaks for boundaries
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

  const dayBreaks = existing
    ? await db
        .select({ startedAt: breakEntries.startedAt, endedAt: breakEntries.endedAt })
        .from(breakEntries)
        .where(eq(breakEntries.attendanceId, existing.id))
    : [];

  let minEventStart: Date | null = null;
  let maxEventEnd: Date | null = null;

  for (const e of dayEntries) {
    if (!minEventStart || e.startedAt.getTime() < minEventStart.getTime()) {
      minEventStart = e.startedAt;
    }
    const end = e.endedAt ?? now;
    if (!maxEventEnd || end.getTime() > maxEventEnd.getTime()) {
      maxEventEnd = end;
    }
  }

  for (const b of dayBreaks) {
    if (!minEventStart || b.startedAt.getTime() < minEventStart.getTime()) {
      minEventStart = b.startedAt;
    }
    const end = b.endedAt ?? now;
    if (!maxEventEnd || end.getTime() > maxEventEnd.getTime()) {
      maxEventEnd = end;
    }
  }

  // Parse input timestamps if provided
  let clockInDate: Date | null = input.clockInAt
    ? typeof input.clockInAt === "string"
      ? new Date(input.clockInAt)
      : input.clockInAt
    : null;

  let clockOutDate: Date | null = input.clockOutAt
    ? typeof input.clockOutAt === "string"
      ? new Date(input.clockOutAt)
      : input.clockOutAt
    : null;

  if (input.action === "clock_out") {
    if (!clockOutDate) {
      clockOutDate = maxEventEnd ?? now;
    }
    input.status = "closed";
  } else if (input.action === "clock_in") {
    if (!clockInDate) {
      clockInDate = minEventStart ?? now;
    }
    input.status = "open";
  }

  if (!existing) {
    const finalClockIn = clockInDate ?? minEventStart ?? now;
    let finalClockOut = clockOutDate;
    const finalStatus: "open" | "closed" =
      input.status ?? (finalClockOut ? "closed" : "open");

    if (finalStatus === "closed" && !finalClockOut) {
      finalClockOut =
        maxEventEnd && maxEventEnd.getTime() > finalClockIn.getTime()
          ? maxEventEnd
          : now;
    }

    const [created] = await db
      .insert(dailyAttendance)
      .values({
        userId,
        workDate,
        clockInAt: finalClockIn,
        clockOutAt: finalStatus === "closed" ? finalClockOut : null,
        status: finalStatus,
        reviewState: finalStatus === "closed" ? "ready" : "draft",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return refreshDTO(created, now);
  }

  // Existing attendance updates
  let finalClockIn = clockInDate ?? existing.clockInAt;
  let finalClockOut =
    input.clockOutAt !== undefined ? clockOutDate : existing.clockOutAt;
  const finalStatus =
    input.status ?? (finalClockOut !== null ? "closed" : existing.status);

  if (finalStatus === "closed" && !finalClockOut) {
    finalClockOut =
      maxEventEnd && maxEventEnd.getTime() > finalClockIn.getTime()
        ? maxEventEnd
        : now;
  }

  // Enveloping checks
  if (minEventStart && finalClockIn.getTime() > minEventStart.getTime()) {
    finalClockIn = minEventStart;
  }
  if (finalStatus === "closed" && finalClockOut) {
    if (maxEventEnd && finalClockOut.getTime() < maxEventEnd.getTime()) {
      finalClockOut = maxEventEnd;
    }
    if (finalClockOut.getTime() < finalClockIn.getTime()) {
      finalClockOut = finalClockIn;
    }
  }

  // If closing attendance:
  if (finalStatus === "closed") {
    await db
      .update(breakEntries)
      .set({ endedAt: finalClockOut ?? now })
      .where(
        and(
          eq(breakEntries.attendanceId, existing.id),
          isNull(breakEntries.endedAt),
        ),
      );

    await db
      .update(timeEntries)
      .set({
        endedAt: finalClockOut ?? now,
        status: "completed",
        pausedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(timeEntries.userId, userId),
          inArray(timeEntries.status, ["active", "paused"]),
          gte(timeEntries.startedAt, dayStart),
          lte(timeEntries.startedAt, dayEnd),
        ),
      );
  }

  const reviewState =
    existing.reviewState === "synced"
      ? "changed_after_sync"
      : finalStatus === "closed"
        ? "ready"
        : "draft";

  const [updated] = await db
    .update(dailyAttendance)
    .set({
      clockInAt: finalClockIn,
      clockOutAt: finalStatus === "closed" ? finalClockOut : null,
      status: finalStatus,
      reviewState,
      updatedAt: now,
    })
    .where(eq(dailyAttendance.id, existing.id))
    .returning();

  return refreshDTO(updated, now);
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
