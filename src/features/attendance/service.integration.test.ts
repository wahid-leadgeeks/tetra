import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { zonedDayEnd, zonedDayStart } from "@/lib/time";
import { schema } from "@/server/db";
import { seedBasics, testDb, setupTestDb } from "@/test/pglite-db";
import {
  autoClosePastAttendances,
  clockIn,
  clockOut,
  createManualBreak,
  deleteBreak,
  endBreak,
  getAttendance,
  getAttendanceToday,
  startBreak,
  updateAttendanceTimes,
  updateBreak,
} from "./service";

vi.mock("@/server/db", async () => (await import("@/test/pglite-db")).dbModuleMock());

const TZ = "Asia/Jakarta";
const { breakEntries, dailyAttendance, tasks, timeEntries } = schema;

setupTestDb();

const PAST_DAY = "2026-01-05";
const pastAt = (h: number, m = 0) => new Date(Date.UTC(2026, 0, 5, h, m)); // Jakarta day 2026-01-05 spans 2026-01-04T17:00Z..2026-01-05T16:59Z

async function addTask(userId: string, categoryId: string, name = "T") {
  const [t] = await testDb.insert(tasks).values({ userId, name, categoryId }).returning();
  return t;
}

describe("attendance service against PGlite", () => {
  describe("clock in / out", () => {
    it("clockIn creates an open row for today", async () => {
      const { userId } = await seedBasics();
      const dto = await clockIn(userId, TZ);
      expect(dto.status).toBe("open");
      expect(dto.clockOutAt).toBeNull();
      const rows = await testDb.select().from(dailyAttendance);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("open");
      expect(rows[0].reviewState).toBe("draft");
      expect((await getAttendanceToday(userId, TZ))?.id).toBe(dto.id);
    });

    it("clockIn twice throws 'Already clocked in'", async () => {
      const { userId } = await seedBasics();
      await clockIn(userId, TZ);
      await expect(clockIn(userId, TZ)).rejects.toThrow("Already clocked in");
      expect(await testDb.select().from(dailyAttendance)).toHaveLength(1);
    });

    it("clockIn after clockOut the same day is rejected", async () => {
      const { userId } = await seedBasics();
      await clockIn(userId, TZ);
      await clockOut(userId, TZ);
      await expect(clockIn(userId, TZ)).rejects.toThrow("Already clocked in");
    });

    it("clockOut closes the row and sets clockOutAt", async () => {
      const { userId } = await seedBasics();
      await clockIn(userId, TZ);
      const dto = await clockOut(userId, TZ);
      expect(dto.status).toBe("closed");
      expect(dto.clockOutAt).not.toBeNull();
      const [row] = await testDb.select().from(dailyAttendance);
      expect(row.status).toBe("closed");
      expect(row.clockOutAt).not.toBeNull();
      expect(row.clockOutAt!.getTime()).toBeGreaterThanOrEqual(row.clockInAt.getTime());
    });

    it("clockOut without clock in throws 'Not clocked in'", async () => {
      const { userId } = await seedBasics();
      await expect(clockOut(userId, TZ)).rejects.toThrow("Not clocked in");
    });

    it("clockOut closes an open break and completes running tasks", async () => {
      const { userId, categoryId } = await seedBasics();
      await clockIn(userId, TZ);
      const task = await addTask(userId, categoryId);
      await testDb.insert(timeEntries).values({ userId, taskId: task.id, categoryId, status: "active" });
      await startBreak(userId, TZ);
      await clockOut(userId, TZ);
      const [entry] = await testDb.select().from(timeEntries);
      expect(entry.status).toBe("completed");
      expect(entry.endedAt).not.toBeNull();
      const [brk] = await testDb.select().from(breakEntries);
      expect(brk.endedAt).not.toBeNull();
    });

    it("attendance is isolated per user", async () => {
      const a = await seedBasics();
      const b = await seedBasics();
      await clockIn(a.userId, TZ);
      await expect(clockOut(b.userId, TZ)).rejects.toThrow("Not clocked in");
      await clockIn(b.userId, TZ);
      expect(await testDb.select().from(dailyAttendance)).toHaveLength(2);
    });
  });

  describe("breaks", () => {
    it("start/end break persists a closed break and reports breakMinutes", async () => {
      const { userId } = await seedBasics();
      await clockIn(userId, TZ);
      const started = await startBreak(userId, TZ);
      expect(started.activeBreak).not.toBeNull();
      // Backdate the break 30 minutes
      await testDb
        .update(breakEntries)
        .set({ startedAt: new Date(Date.now() - 30 * 60_000) });
      const ended = await endBreak(userId, TZ);
      expect(ended.activeBreak).toBeNull();
      expect(ended.breaks).toHaveLength(1);
      expect(ended.breakMinutes).toBe(30);
      const [brk] = await testDb.select().from(breakEntries);
      expect(brk.endedAt).not.toBeNull();
    });

    it("startBreak errors: not clocked in, already on break", async () => {
      const { userId } = await seedBasics();
      await expect(startBreak(userId, TZ)).rejects.toThrow("Not clocked in");
      await clockIn(userId, TZ);
      await startBreak(userId, TZ);
      await expect(startBreak(userId, TZ)).rejects.toThrow("Already on break");
      expect(await testDb.select().from(breakEntries)).toHaveLength(1);
    });

    it("endBreak errors: not clocked in, not on break", async () => {
      const { userId } = await seedBasics();
      await expect(endBreak(userId, TZ)).rejects.toThrow("Not clocked in");
      await clockIn(userId, TZ);
      await expect(endBreak(userId, TZ)).rejects.toThrow("Not on break");
    });

    it("startBreak auto-pauses the active task", async () => {
      const { userId, categoryId } = await seedBasics();
      await clockIn(userId, TZ);
      const task = await addTask(userId, categoryId);
      await testDb.insert(timeEntries).values({ userId, taskId: task.id, categoryId, status: "active" });
      await startBreak(userId, TZ);
      const [entry] = await testDb.select().from(timeEntries);
      expect(entry.status).toBe("paused");
      expect(entry.pausedAt).not.toBeNull();
    });

    it("createManualBreak creates closed attendance for an unseen day", async () => {
      const { userId } = await seedBasics();
      const brk = await createManualBreak(userId, TZ, {
        workDate: PAST_DAY,
        startedAt: pastAt(5),
        endedAt: pastAt(6),
      });
      expect(brk.id).toBeTruthy();
      const [att] = await testDb.select().from(dailyAttendance);
      expect(att.status).toBe("closed");
      expect(att.reviewState).toBe("ready");
    });

    it("createManualBreak rejects end <= start and overlapping breaks", async () => {
      const { userId } = await seedBasics();
      await expect(
        createManualBreak(userId, TZ, { workDate: PAST_DAY, startedAt: pastAt(5), endedAt: pastAt(5) }),
      ).rejects.toThrow("End time must be after start time");
      await createManualBreak(userId, TZ, { workDate: PAST_DAY, startedAt: pastAt(5), endedAt: pastAt(6) });
      await expect(
        createManualBreak(userId, TZ, { workDate: PAST_DAY, startedAt: pastAt(5, 30), endedAt: pastAt(7) }),
      ).rejects.toThrow("Break overlaps with an existing break");
      expect(await testDb.select().from(breakEntries)).toHaveLength(1);
    });

    it("createManualBreak widens clock bounds and flags synced days", async () => {
      const { userId } = await seedBasics();
      await testDb.insert(dailyAttendance).values({
        userId,
        workDate: PAST_DAY,
        clockInAt: pastAt(2),
        clockOutAt: pastAt(8),
        status: "closed",
        reviewState: "synced",
      });
      await createManualBreak(userId, TZ, { workDate: PAST_DAY, startedAt: pastAt(1), endedAt: pastAt(9) });
      const [att] = await testDb.select().from(dailyAttendance);
      expect(att.clockInAt).toEqual(pastAt(1));
      expect(att.clockOutAt).toEqual(pastAt(9));
      expect(att.reviewState).toBe("changed_after_sync");
    });

    it("createManualBreak that widens bounds but overlaps leaves attendance untouched", async () => {
      const { userId } = await seedBasics();
      await testDb.insert(dailyAttendance).values({
        userId,
        workDate: PAST_DAY,
        clockInAt: pastAt(2),
        clockOutAt: pastAt(8),
        status: "closed",
        reviewState: "synced",
      });
      await createManualBreak(userId, TZ, { workDate: PAST_DAY, startedAt: pastAt(5), endedAt: pastAt(6) });
      await testDb.update(dailyAttendance).set({ reviewState: "synced" });
      const [before] = await testDb.select().from(dailyAttendance);

      await expect(
        createManualBreak(userId, TZ, { workDate: PAST_DAY, startedAt: pastAt(5, 30), endedAt: pastAt(9) }),
      ).rejects.toThrow("Break overlaps with an existing break");

      const [after] = await testDb.select().from(dailyAttendance);
      expect(after.clockInAt).toEqual(pastAt(2));
      expect(after.clockOutAt).toEqual(pastAt(8));
      expect(after.reviewState).toBe("synced");
      expect(after.updatedAt).toEqual(before.updatedAt);
      expect(await testDb.select().from(breakEntries)).toHaveLength(1);
    });
  });

  describe("break mutations bump updated_at (needs-sync signal)", () => {
    const EARLIER = new Date("2025-12-01T00:00:00Z");

    async function openBreakWithEarlierStamp(userId: string, reviewState: "ready" | "synced") {
      await clockIn(userId, TZ);
      await startBreak(userId, TZ);
      await testDb.update(dailyAttendance).set({ reviewState, updatedAt: EARLIER, lastSyncedAt: EARLIER });
    }

    it("startBreak bumps updated_at and keeps a ready day ready", async () => {
      const { userId } = await seedBasics();
      await clockIn(userId, TZ);
      await testDb.update(dailyAttendance).set({ reviewState: "ready", updatedAt: EARLIER });
      await startBreak(userId, TZ);
      const [att] = await testDb.select().from(dailyAttendance);
      expect(att.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
      expect(att.reviewState).toBe("ready");
    });

    it("endBreak on a ready day bumps updated_at and keeps review_state", async () => {
      const { userId } = await seedBasics();
      await openBreakWithEarlierStamp(userId, "ready");
      await endBreak(userId, TZ);
      const [att] = await testDb.select().from(dailyAttendance);
      expect(att.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
      expect(att.updatedAt.getTime()).toBeGreaterThan(att.lastSyncedAt!.getTime());
      expect(att.reviewState).toBe("ready");
    });

    it("endBreak on a synced day flips it to changed_after_sync", async () => {
      const { userId } = await seedBasics();
      await openBreakWithEarlierStamp(userId, "synced");
      await endBreak(userId, TZ);
      const [att] = await testDb.select().from(dailyAttendance);
      expect(att.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
      expect(att.reviewState).toBe("changed_after_sync");
    });

    it("createManualBreak fully inside the span of a ready day bumps updated_at", async () => {
      const { userId } = await seedBasics();
      await testDb.insert(dailyAttendance).values({
        userId,
        workDate: PAST_DAY,
        clockInAt: pastAt(2),
        clockOutAt: pastAt(8),
        status: "closed",
        reviewState: "ready",
        lastSyncedAt: EARLIER,
        updatedAt: EARLIER,
      });
      await createManualBreak(userId, TZ, { workDate: PAST_DAY, startedAt: pastAt(4), endedAt: pastAt(5) });
      const [att] = await testDb.select().from(dailyAttendance);
      expect(att.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
      expect(att.reviewState).toBe("ready");
      expect(att.clockInAt).toEqual(pastAt(2));
      expect(att.clockOutAt).toEqual(pastAt(8));
    });

    it("updateBreak and deleteBreak bump updated_at; a synced day becomes changed_after_sync", async () => {
      const { userId } = await seedBasics();
      await testDb.insert(dailyAttendance).values({
        userId,
        workDate: PAST_DAY,
        clockInAt: pastAt(2),
        clockOutAt: pastAt(8),
        status: "closed",
        reviewState: "ready",
      });
      const brk = await createManualBreak(userId, TZ, { workDate: PAST_DAY, startedAt: pastAt(4), endedAt: pastAt(5) });

      await testDb.update(dailyAttendance).set({ reviewState: "ready", updatedAt: EARLIER });
      await updateBreak(userId, brk.id, TZ, { endedAt: pastAt(4, 30) });
      let [att] = await testDb.select().from(dailyAttendance);
      expect(att.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
      expect(att.reviewState).toBe("ready");

      await testDb.update(dailyAttendance).set({ reviewState: "synced", updatedAt: EARLIER });
      await deleteBreak(userId, brk.id, TZ);
      [att] = await testDb.select().from(dailyAttendance);
      expect(att.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
      expect(att.reviewState).toBe("changed_after_sync");
    });
  });

  describe("autoClosePastAttendances", () => {
    it("closes a past open shift at the latest task/break end, completing running work", async () => {
      const { userId, categoryId } = await seedBasics();
      const [att] = await testDb
        .insert(dailyAttendance)
        .values({ userId, workDate: PAST_DAY, clockInAt: pastAt(2), status: "open" })
        .returning();
      const task = await addTask(userId, categoryId);
      // completed task 03:00-04:00Z
      await testDb.insert(timeEntries).values({
        userId, taskId: task.id, categoryId, startedAt: pastAt(3), endedAt: pastAt(4), status: "completed",
      });
      // still-active task started 05:00Z -> closed at end of day
      const [active] = await testDb
        .insert(timeEntries)
        .values({ userId, taskId: task.id, categoryId, startedAt: pastAt(5), status: "active" })
        .returning();
      // open break
      const [brk] = await testDb
        .insert(breakEntries)
        .values({ userId, attendanceId: att.id, startedAt: pastAt(6) })
        .returning();

      await autoClosePastAttendances(userId, TZ);

      const dayEnd = zonedDayEnd(PAST_DAY, TZ);
      const [row] = await testDb.select().from(dailyAttendance);
      expect(row.status).toBe("closed");
      expect(row.clockOutAt).toEqual(dayEnd);
      expect(row.clockInAt).toEqual(pastAt(2));
      const [a] = await testDb.select().from(timeEntries).where(eq(timeEntries.id, active.id));
      expect(a.status).toBe("completed");
      expect(a.endedAt).toEqual(dayEnd);
      const [b] = await testDb.select().from(breakEntries).where(eq(breakEntries.id, brk.id));
      expect(b.endedAt).toEqual(dayEnd);
    });

    it("with no activity, clockOutAt falls back to clockInAt", async () => {
      const { userId } = await seedBasics();
      await testDb
        .insert(dailyAttendance)
        .values({ userId, workDate: PAST_DAY, clockInAt: pastAt(2), status: "open" });
      await autoClosePastAttendances(userId, TZ);
      const [row] = await testDb.select().from(dailyAttendance);
      expect(row.status).toBe("closed");
      expect(row.clockOutAt).toEqual(pastAt(2));
    });

    it("does not touch today's open shift, closed shifts, or other users", async () => {
      const a = await seedBasics();
      const b = await seedBasics();
      await clockIn(a.userId, TZ);
      await testDb
        .insert(dailyAttendance)
        .values({ userId: b.userId, workDate: PAST_DAY, clockInAt: pastAt(2), status: "open" });
      await autoClosePastAttendances(a.userId, TZ);
      const rows = await testDb.select().from(dailyAttendance);
      expect(rows.find((r) => r.userId === a.userId)?.status).toBe("open");
      expect(rows.find((r) => r.userId === b.userId)?.status).toBe("open");
    });

    it("clockIn auto-closes a lingering past shift and then succeeds", async () => {
      const { userId } = await seedBasics();
      await testDb
        .insert(dailyAttendance)
        .values({ userId, workDate: PAST_DAY, clockInAt: pastAt(2), status: "open" });
      const dto = await clockIn(userId, TZ);
      expect(dto.status).toBe("open");
      const rows = await testDb.select().from(dailyAttendance);
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.workDate === PAST_DAY)?.status).toBe("closed");
      expect(rows.filter((r) => r.status === "open")).toHaveLength(1);
    });

    it("is idempotent", async () => {
      const { userId } = await seedBasics();
      await testDb
        .insert(dailyAttendance)
        .values({ userId, workDate: PAST_DAY, clockInAt: pastAt(2), status: "open" });
      await autoClosePastAttendances(userId, TZ);
      const [first] = await testDb.select().from(dailyAttendance);
      await autoClosePastAttendances(userId, TZ);
      const [second] = await testDb.select().from(dailyAttendance);
      expect(second.clockOutAt).toEqual(first.clockOutAt);
    });
  });

  describe("updateAttendanceTimes (daily attendance persistence)", () => {
    it("creates a closed row with envelope of existing entries when none exists", async () => {
      const { userId, categoryId } = await seedBasics();
      const task = await addTask(userId, categoryId);
      await testDb.insert(timeEntries).values({
        userId, taskId: task.id, categoryId, startedAt: pastAt(3), endedAt: pastAt(5), status: "completed",
      });
      const dto = await updateAttendanceTimes(userId, PAST_DAY, TZ, { action: "clock_out" });
      expect(dto.status).toBe("closed");
      const [row] = await testDb.select().from(dailyAttendance);
      expect(row.workDate).toBe(PAST_DAY);
      expect(row.clockInAt).toEqual(pastAt(3));
      expect(row.clockOutAt).toEqual(pastAt(5));
      expect(row.reviewState).toBe("ready");
    });

    it("clamps requested times so the shift envelopes its entries", async () => {
      const { userId, categoryId } = await seedBasics();
      const task = await addTask(userId, categoryId);
      await testDb.insert(timeEntries).values({
        userId, taskId: task.id, categoryId, startedAt: pastAt(3), endedAt: pastAt(5), status: "completed",
      });
      await testDb.insert(dailyAttendance).values({
        userId, workDate: PAST_DAY, clockInAt: pastAt(2), clockOutAt: pastAt(6), status: "closed",
      });
      await updateAttendanceTimes(userId, PAST_DAY, TZ, { clockInAt: pastAt(4), clockOutAt: pastAt(4, 30) });
      const [row] = await testDb.select().from(dailyAttendance);
      expect(row.clockInAt).toEqual(pastAt(3));
      expect(row.clockOutAt).toEqual(pastAt(5));
    });

    it("closing completes the day's running tasks and open breaks; synced becomes changed_after_sync", async () => {
      const { userId, categoryId } = await seedBasics();
      const task = await addTask(userId, categoryId);
      const [att] = await testDb
        .insert(dailyAttendance)
        .values({ userId, workDate: PAST_DAY, clockInAt: pastAt(2), status: "open", reviewState: "synced" })
        .returning();
      await testDb.insert(timeEntries).values({
        userId, taskId: task.id, categoryId, startedAt: pastAt(3), status: "active",
      });
      await testDb.insert(breakEntries).values({ userId, attendanceId: att.id, startedAt: pastAt(4) });
      await updateAttendanceTimes(userId, PAST_DAY, TZ, { clockOutAt: pastAt(8) });
      const [row] = await testDb.select().from(dailyAttendance);
      expect(row.status).toBe("closed");
      expect(row.reviewState).toBe("changed_after_sync");
      const [e] = await testDb.select().from(timeEntries);
      expect(e.status).toBe("completed");
      expect(e.endedAt).not.toBeNull();
      const [b] = await testDb.select().from(breakEntries);
      expect(b.endedAt).not.toBeNull();
    });

    it("reopening via clock_in clears clockOutAt", async () => {
      const { userId } = await seedBasics();
      await testDb.insert(dailyAttendance).values({
        userId, workDate: PAST_DAY, clockInAt: pastAt(2), clockOutAt: pastAt(8), status: "closed",
      });
      await updateAttendanceTimes(userId, PAST_DAY, TZ, { action: "clock_in" });
      const [row] = await testDb.select().from(dailyAttendance);
      expect(row.status).toBe("open");
      expect(row.clockOutAt).toBeNull();
      expect(row.reviewState).toBe("draft");
    });

    it("getAttendance returns null for a day without a row, and the row's breaks otherwise", async () => {
      const { userId } = await seedBasics();
      expect(await getAttendance(userId, PAST_DAY)).toBeNull();
      await createManualBreak(userId, TZ, { workDate: PAST_DAY, startedAt: pastAt(5), endedAt: pastAt(6) });
      const dto = await getAttendance(userId, PAST_DAY);
      expect(dto?.breaks).toHaveLength(1);
      expect(dto?.breakMinutes).toBe(60);
    });
  });

  it("zonedDayStart/End bracket the test fixtures as assumed", () => {
    expect(zonedDayStart(PAST_DAY, TZ).getTime()).toBeLessThanOrEqual(pastAt(0).getTime());
    expect(zonedDayEnd(PAST_DAY, TZ).getTime()).toBeGreaterThanOrEqual(pastAt(9).getTime());
  });
});
