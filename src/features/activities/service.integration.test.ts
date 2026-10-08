import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { getDaySummary } from "@/features/daily-summary/service";
import { schema } from "@/server/db";
import { seedBasics, testDb, setupTestDb } from "@/test/pglite-db";
import { OverlapError } from "./domain";
import { upsertTask } from "./entry-helpers";
import { getDayEntries } from "./entry-queries";
import {
  createManualEntry,
  deleteEntry,
  deleteTask,
  getActiveEntry,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
  updateEntry,
  updateTask,
} from "./service";

vi.mock("@/server/db", async () => (await import("@/test/pglite-db")).dbModuleMock());

const TZ = "Asia/Jakarta";
const { tasks, timeEntries, breakEntries, dailyAttendance } = schema;

setupTestDb();

describe("activities service against PGlite", () => {
  describe("upsertTask ON CONFLICT", () => {
    it("creates a task in_progress with startedAt = now", async () => {
      const { userId, categoryId } = await seedBasics();
      const now = new Date("2026-01-05T03:00:00Z");
      const task = await testDb.transaction((tx) => upsertTask(tx, userId, "Write docs", categoryId, now));
      expect(task.status).toBe("in_progress");
      expect(task.startedAt).toEqual(now);
      expect(task.lastUsedAt).toEqual(now);
    });

    it("fills startedAt from excluded.started_at when the existing row has none (regression 0b47a37)", async () => {
      const { userId, categoryId } = await seedBasics();
      await testDb.insert(tasks).values({ userId, name: "Backlog item", categoryId, status: "backlog" });
      const now = new Date("2026-01-05T03:00:00Z");
      const task = await testDb.transaction((tx) => upsertTask(tx, userId, "Backlog item", categoryId, now));
      expect(task.startedAt).toEqual(now);
      expect(task.status).toBe("in_progress");
      expect(task.lastUsedAt).toEqual(now);
    });

    it("keeps an existing startedAt and a non-todo status, but refreshes category and lastUsedAt", async () => {
      const { userId, categoryId } = await seedBasics();
      const [other] = await testDb.insert(schema.categories).values({ key: "other", name: "Other" }).returning();
      const first = new Date("2026-01-05T03:00:00Z");
      await testDb.transaction((tx) => upsertTask(tx, userId, "Same", categoryId, first));
      await testDb.update(tasks).set({ status: "done" }).where(eq(tasks.userId, userId));
      const later = new Date("2026-01-06T03:00:00Z");
      const task = await testDb.transaction((tx) => upsertTask(tx, userId, "Same", other.id, later));
      expect(task.startedAt).toEqual(first);
      expect(task.status).toBe("done");
      expect(task.categoryId).toBe(other.id);
      expect(task.lastUsedAt).toEqual(later);
      expect(await testDb.select().from(tasks)).toHaveLength(1);
    });

    it("moves todo to in_progress on conflict", async () => {
      const { userId, categoryId } = await seedBasics();
      await testDb.insert(tasks).values({ userId, name: "T", categoryId, status: "todo" });
      const task = await testDb.transaction((tx) => upsertTask(tx, userId, "T", categoryId, new Date()));
      expect(task.status).toBe("in_progress");
    });

    it("scopes uniqueness per user", async () => {
      const a = await seedBasics();
      const b = await seedBasics();
      await testDb.transaction((tx) => upsertTask(tx, a.userId, "Shared", a.categoryId, new Date()));
      await testDb.transaction((tx) => upsertTask(tx, b.userId, "Shared", a.categoryId, new Date()));
      expect(await testDb.select().from(tasks)).toHaveLength(2);
    });
  });

  describe("timer lifecycle", () => {
    it("start creates an active entry and a task", async () => {
      const { userId, categoryId } = await seedBasics();
      const dto = await startTimer(userId, TZ, { taskName: "Alpha", categoryId, notes: "n" });
      expect(dto.status).toBe("active");
      expect(dto.endedAt).toBeNull();
      expect(dto.notes).toBe("n");
      expect((await getActiveEntry(userId))?.id).toBe(dto.id);
    });

    it("carries the task's details on startTimer and getDayEntries", async () => {
      const { userId, categoryId } = await seedBasics();
      const dueAt = new Date("2026-10-07T23:59:59Z");
      await testDb.insert(tasks).values({
        userId,
        name: "Detailed",
        categoryId,
        priority: "high",
        description: "Prepare slides",
        dueAt,
        isFavorite: true,
      });
      const dto = await startTimer(userId, TZ, { taskName: "Detailed", categoryId });
      const expected = {
        categoryId,
        status: "in_progress",
        priority: "high",
        description: "Prepare slides",
        dueAt: dueAt.toISOString(),
        isFavorite: true,
      };
      expect(dto.taskDetails).toEqual(expected);
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
      const entries = await getDayEntries(userId, day, TZ);
      expect(entries.find((e) => e.id === dto.id)?.taskDetails).toEqual(expected);
    });

    it("starting a second timer stops the first (single current entry)", async () => {
      const { userId, categoryId } = await seedBasics();
      const first = await startTimer(userId, TZ, { taskName: "A", categoryId });
      const second = await startTimer(userId, TZ, { taskName: "B", categoryId });
      const rows = await testDb.select().from(timeEntries);
      expect(rows).toHaveLength(2);
      const firstRow = rows.find((r) => r.id === first.id);
      expect(firstRow?.status).toBe("completed");
      expect(firstRow?.endedAt).not.toBeNull();
      expect(rows.filter((r) => r.status === "active").map((r) => r.id)).toEqual([second.id]);
    });

    it("re-starting an existing task name reuses the task row", async () => {
      const { userId, categoryId } = await seedBasics();
      await startTimer(userId, TZ, { taskName: "Same", categoryId });
      await stopTimer(userId, TZ);
      await startTimer(userId, TZ, { taskName: "Same", categoryId });
      expect(await testDb.select().from(tasks)).toHaveLength(1);
    });

    it("rejects unknown category and leaves nothing behind", async () => {
      const { userId } = await seedBasics();
      await expect(
        startTimer(userId, TZ, { taskName: "X", categoryId: "00000000-0000-4000-8000-000000000000" }),
      ).rejects.toThrow("Unknown category");
      expect(await testDb.select().from(tasks)).toHaveLength(0);
      expect(await testDb.select().from(timeEntries)).toHaveLength(0);
    });

    it("stop completes the entry; throws when nothing runs", async () => {
      const { userId, categoryId } = await seedBasics();
      await expect(stopTimer(userId, TZ)).rejects.toThrow("No active task");
      const started = await startTimer(userId, TZ, { taskName: "A", categoryId });
      const stopped = await stopTimer(userId, TZ);
      expect(stopped.id).toBe(started.id);
      expect(stopped.status).toBe("completed");
      expect(stopped.endedAt).not.toBeNull();
      expect(await getActiveEntry(userId)).toBeNull();
    });

    it("pause then resume banks pausedSeconds and clears pausedAt", async () => {
      const { userId, categoryId } = await seedBasics();
      await startTimer(userId, TZ, { taskName: "A", categoryId });
      const paused = await pauseTimer(userId);
      expect(paused.status).toBe("paused");
      // Backdate the pause by 90s so the banked amount is deterministic
      await testDb
        .update(timeEntries)
        .set({ pausedAt: new Date(Date.now() - 90_000) })
        .where(eq(timeEntries.id, paused.id));
      const resumed = await resumeTimer(userId);
      expect(resumed.status).toBe("active");
      const [row] = await testDb.select().from(timeEntries);
      expect(row.pausedAt).toBeNull();
      expect(row.pausedSeconds).toBeGreaterThanOrEqual(90);
      expect(row.pausedSeconds).toBeLessThan(100);
    });

    it("pause errors without an active task; resume errors without a paused task", async () => {
      const { userId, categoryId } = await seedBasics();
      await expect(pauseTimer(userId)).rejects.toThrow("No active task");
      await expect(resumeTimer(userId)).rejects.toThrow("No paused task");
      await startTimer(userId, TZ, { taskName: "A", categoryId });
      await expect(resumeTimer(userId)).rejects.toThrow("No paused task");
    });

    it("pause while clocked in opens a break; resume closes it", async () => {
      const { userId, categoryId } = await seedBasics();
      const [att] = await testDb
        .insert(dailyAttendance)
        .values({ userId, workDate: "2026-01-05", status: "open" })
        .returning();
      await startTimer(userId, TZ, { taskName: "A", categoryId });
      await pauseTimer(userId);
      let breaks = await testDb.select().from(breakEntries);
      expect(breaks).toHaveLength(1);
      expect(breaks[0].attendanceId).toBe(att.id);
      expect(breaks[0].endedAt).toBeNull();
      await resumeTimer(userId);
      breaks = await testDb.select().from(breakEntries);
      expect(breaks[0].endedAt).not.toBeNull();
    });

    it("pause without attendance creates no break", async () => {
      const { userId, categoryId } = await seedBasics();
      await startTimer(userId, TZ, { taskName: "A", categoryId });
      await pauseTimer(userId);
      expect(await testDb.select().from(breakEntries)).toHaveLength(0);
    });

    it("stopping flags a synced day as changed_after_sync", async () => {
      const { userId, categoryId } = await seedBasics();
      const started = await startTimer(userId, TZ, { taskName: "A", categoryId });
      const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(started.startedAt));
      await testDb.insert(dailyAttendance).values({ userId, workDate: dayKey, status: "closed", reviewState: "synced" });
      await stopTimer(userId, TZ);
      const [att] = await testDb.select().from(dailyAttendance);
      expect(att.reviewState).toBe("changed_after_sync");
    });
  });

  describe("manual entries and overlap validation", () => {
    const at = (h: number, m = 0) => new Date(Date.UTC(2026, 0, 5, h, m));

    it("creates a completed manual entry and creates closed attendance for a past day", async () => {
      const { userId, categoryId } = await seedBasics();
      const dto = await createManualEntry(userId, TZ, {
        taskName: "Backfill",
        categoryId,
        startedAt: at(2),
        endedAt: at(3),
      });
      expect(dto.status).toBe("completed");
      const [att] = await testDb.select().from(dailyAttendance);
      expect(att.status).toBe("closed");
      expect(att.workDate).toBe("2026-01-05");
      expect(att.clockInAt).toEqual(at(2));
      expect(att.clockOutAt).toEqual(at(3));
    });

    it("rejects end <= start", async () => {
      const { userId, categoryId } = await seedBasics();
      await expect(
        createManualEntry(userId, TZ, { taskName: "Bad", categoryId, startedAt: at(3), endedAt: at(3) }),
      ).rejects.toThrow("End time must be after start time");
    });

    it("rejects an overlapping manual entry with OverlapError and persists nothing", async () => {
      const { userId, categoryId } = await seedBasics();
      await createManualEntry(userId, TZ, { taskName: "One", categoryId, startedAt: at(2), endedAt: at(4) });
      await expect(
        createManualEntry(userId, TZ, { taskName: "Two", categoryId, startedAt: at(3), endedAt: at(5) }),
      ).rejects.toBeInstanceOf(OverlapError);
      expect(await testDb.select().from(timeEntries)).toHaveLength(1);
      expect((await testDb.select().from(tasks)).map((t) => t.name)).toEqual(["One"]);
    });

    it("allows back-to-back entries (touching boundaries)", async () => {
      const { userId, categoryId } = await seedBasics();
      await createManualEntry(userId, TZ, { taskName: "One", categoryId, startedAt: at(2), endedAt: at(3) });
      await createManualEntry(userId, TZ, { taskName: "Two", categoryId, startedAt: at(3), endedAt: at(4) });
      expect(await testDb.select().from(timeEntries)).toHaveLength(2);
    });

    it("does not treat another user's entries as overlapping", async () => {
      const a = await seedBasics();
      const b = await seedBasics();
      await createManualEntry(a.userId, TZ, { taskName: "One", categoryId: a.categoryId, startedAt: at(2), endedAt: at(4) });
      await createManualEntry(b.userId, TZ, { taskName: "One", categoryId: a.categoryId, startedAt: at(2), endedAt: at(4) });
      expect(await testDb.select().from(timeEntries)).toHaveLength(2);
    });

    it("updateEntry re-validates overlap but ignores the entry itself", async () => {
      const { userId, categoryId } = await seedBasics();
      const one = await createManualEntry(userId, TZ, { taskName: "One", categoryId, startedAt: at(2), endedAt: at(3) });
      await createManualEntry(userId, TZ, { taskName: "Two", categoryId, startedAt: at(4), endedAt: at(5) });
      // Extending within its own range is fine
      const ok = await updateEntry(userId, one.id, { endedAt: at(3, 30) }, TZ);
      expect(ok.endedAt).toBe(at(3, 30).toISOString());
      // Extending into the next entry is not
      await expect(updateEntry(userId, one.id, { endedAt: at(4, 30) }, TZ)).rejects.toBeInstanceOf(OverlapError);
      const [row] = await testDb.select().from(timeEntries).where(eq(timeEntries.id, one.id));
      expect(row.endedAt).toEqual(at(3, 30));
    });

    it("updateEntry on a missing entry throws; deleteEntry removes the row", async () => {
      const { userId, categoryId } = await seedBasics();
      await expect(
        updateEntry(userId, "00000000-0000-4000-8000-000000000000", { notes: "x" }, TZ),
      ).rejects.toThrow("Entry not found");
      const one = await createManualEntry(userId, TZ, { taskName: "One", categoryId, startedAt: at(2), endedAt: at(3) });
      await deleteEntry(userId, one.id, TZ);
      expect(await testDb.select().from(timeEntries)).toHaveLength(0);
      await expect(deleteEntry(userId, one.id, TZ)).rejects.toThrow("Entry not found");
    });
  });

  describe("multi-day change flags (needs-sync signal)", () => {
    const NY = "America/New_York";
    const EARLIER = new Date("2025-12-01T00:00:00Z");

    async function seedDays(userId: string, days: string[]) {
      for (const workDate of days) {
        await testDb.insert(dailyAttendance).values({
          userId,
          workDate,
          clockInAt: new Date(`${workDate}T13:00:00Z`),
          clockOutAt: new Date(`${workDate}T22:00:00Z`),
          status: "closed",
          reviewState: "ready",
        });
      }
    }

    async function resetStamps() {
      await testDb.update(dailyAttendance).set({ updatedAt: EARLIER, lastSyncedAt: EARLIER });
    }

    async function stampByDay() {
      const rows = await testDb.select().from(dailyAttendance);
      return new Map(rows.map((r) => [r.workDate, r] as const));
    }

    it("deleteEntry of an entry spanning local midnight bumps both days", async () => {
      const { userId, categoryId } = await seedBasics({ timezone: NY });
      await seedDays(userId, ["2026-01-05", "2026-01-06", "2026-01-07"]);
      // 23:00 Jan 5 → 01:00 Jan 6 in New York (EST, UTC-5).
      const entry = await createManualEntry(userId, NY, {
        taskName: "Late night",
        categoryId,
        startedAt: new Date("2026-01-06T04:00:00Z"),
        endedAt: new Date("2026-01-06T06:00:00Z"),
      });
      await resetStamps();
      await testDb.update(dailyAttendance).set({ reviewState: "synced" }).where(eq(dailyAttendance.workDate, "2026-01-06"));

      await deleteEntry(userId, entry.id, NY);

      const days = await stampByDay();
      expect(days.get("2026-01-05")!.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
      expect(days.get("2026-01-06")!.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
      expect(days.get("2026-01-07")!.updatedAt).toEqual(EARLIER);
      expect(days.get("2026-01-05")!.reviewState).toBe("ready");
      expect(days.get("2026-01-06")!.reviewState).toBe("changed_after_sync");
    });

    it("updateEntry moving an entry from day A to day B bumps both", async () => {
      const { userId, categoryId } = await seedBasics({ timezone: NY });
      await seedDays(userId, ["2026-01-05", "2026-01-07", "2026-01-08"]);
      const entry = await createManualEntry(userId, NY, {
        taskName: "Movable",
        categoryId,
        startedAt: new Date("2026-01-05T15:00:00Z"),
        endedAt: new Date("2026-01-05T16:00:00Z"),
      });
      await resetStamps();

      await updateEntry(
        userId,
        entry.id,
        { startedAt: new Date("2026-01-07T15:00:00Z"), endedAt: new Date("2026-01-07T16:00:00Z") },
        NY,
      );

      const days = await stampByDay();
      expect(days.get("2026-01-05")!.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
      expect(days.get("2026-01-07")!.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
      expect(days.get("2026-01-08")!.updatedAt).toEqual(EARLIER);
    });

    describe("updateTask / deleteTask", () => {
      /** One task with entries on Jan 5 and Jan 7 (NY local); Jan 8 has none. */
      async function seedTaskOnTwoDays() {
        const { userId, categoryId } = await seedBasics({ timezone: NY });
        await seedDays(userId, ["2026-01-05", "2026-01-07", "2026-01-08"]);
        const first = await createManualEntry(userId, NY, {
          taskName: "Shared task",
          categoryId,
          startedAt: new Date("2026-01-05T15:00:00Z"),
          endedAt: new Date("2026-01-05T16:00:00Z"),
        });
        const second = await createManualEntry(userId, NY, {
          taskName: "Shared task",
          categoryId,
          startedAt: new Date("2026-01-07T15:00:00Z"),
          endedAt: new Date("2026-01-07T16:00:00Z"),
        });
        expect(second.taskId).toBe(first.taskId);
        await resetStamps();
        return { userId, categoryId, taskId: first.taskId };
      }

      it("renaming a task bumps every day with its entries, not unrelated days", async () => {
        const { userId, taskId } = await seedTaskOnTwoDays();
        // Entries predate the sync too, so only the rename can flag the days.
        await testDb.update(timeEntries).set({ updatedAt: EARLIER });
        for (const day of ["2026-01-05", "2026-01-07", "2026-01-08"]) {
          expect((await getDaySummary(userId, day, NY)).needsSync).toBe(false);
        }

        await updateTask(userId, taskId, { name: "Renamed task" }, NY);

        const days = await stampByDay();
        for (const day of ["2026-01-05", "2026-01-07"]) {
          const row = days.get(day)!;
          expect(row.updatedAt.getTime()).toBeGreaterThan(row.lastSyncedAt!.getTime());
          expect((await getDaySummary(userId, day, NY)).needsSync).toBe(true);
        }
        expect(days.get("2026-01-08")!.updatedAt).toEqual(EARLIER);
        expect((await getDaySummary(userId, "2026-01-08", NY)).needsSync).toBe(false);
      });

      it("changing only status, priority or description bumps no day", async () => {
        const { userId, taskId } = await seedTaskOnTwoDays();

        await updateTask(userId, taskId, { status: "done" }, NY);
        await updateTask(userId, taskId, { priority: "high" }, NY);
        await updateTask(userId, taskId, { description: "More detail" }, NY);
        // Same name (after trim) is not a sheet-relevant change either.
        await updateTask(userId, taskId, { name: "  Shared task  " }, NY);

        const days = await stampByDay();
        for (const day of ["2026-01-05", "2026-01-07", "2026-01-08"]) {
          expect(days.get(day)!.updatedAt).toEqual(EARLIER);
        }
      });

      it("changing the category bumps every day with its entries", async () => {
        const { userId, taskId } = await seedTaskOnTwoDays();
        const [other] = await testDb
          .insert(schema.categories)
          .values({ key: `other-${Date.now()}`, name: "Other" })
          .returning();

        await updateTask(userId, taskId, { categoryId: other.id }, NY);

        const days = await stampByDay();
        expect(days.get("2026-01-05")!.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
        expect(days.get("2026-01-07")!.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
        expect(days.get("2026-01-08")!.updatedAt).toEqual(EARLIER);
      });

      it("a synced day flips to changed_after_sync; a ready day stays ready", async () => {
        const { userId, taskId } = await seedTaskOnTwoDays();
        await testDb
          .update(dailyAttendance)
          .set({ reviewState: "synced" })
          .where(eq(dailyAttendance.workDate, "2026-01-05"));

        await updateTask(userId, taskId, { name: "Renamed again" }, NY);

        const days = await stampByDay();
        expect(days.get("2026-01-05")!.reviewState).toBe("changed_after_sync");
        expect(days.get("2026-01-07")!.reviewState).toBe("ready");
      });

      it("an entry crossing local midnight in America/New_York marks both days", async () => {
        const { userId, categoryId } = await seedBasics({ timezone: NY });
        await seedDays(userId, ["2026-01-05", "2026-01-06", "2026-01-07"]);
        // 23:00 Jan 5 → 01:00 Jan 6 in New York (EST, UTC-5).
        const entry = await createManualEntry(userId, NY, {
          taskName: "Night owl",
          categoryId,
          startedAt: new Date("2026-01-06T04:00:00Z"),
          endedAt: new Date("2026-01-06T06:00:00Z"),
        });
        await resetStamps();

        await updateTask(userId, entry.taskId, { name: "Night owl (renamed)" }, NY);

        const days = await stampByDay();
        expect(days.get("2026-01-05")!.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
        expect(days.get("2026-01-06")!.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
        expect(days.get("2026-01-07")!.updatedAt).toEqual(EARLIER);
      });

      it("deleteTask bumps every day that had its entries and removes the entries", async () => {
        const { userId, taskId } = await seedTaskOnTwoDays();

        expect(await deleteTask(userId, taskId, NY)).toBe(true);

        const days = await stampByDay();
        expect(days.get("2026-01-05")!.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
        expect(days.get("2026-01-07")!.updatedAt.getTime()).toBeGreaterThan(EARLIER.getTime());
        expect(days.get("2026-01-08")!.updatedAt).toEqual(EARLIER);
        expect(
          await testDb.select().from(timeEntries).where(eq(timeEntries.taskId, taskId)),
        ).toHaveLength(0);
        expect(await deleteTask(userId, taskId, NY)).toBe(false);
      });
    });
  });
});
