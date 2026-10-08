import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schema } from "@/server/db";
import { seedBasics, setupTestDb, testDb } from "@/test/pglite-db";

vi.mock("@/server/db", async () => (await import("@/test/pglite-db")).dbModuleMock());

import { getDaySummary } from "./service";
import {
  clockIn,
  createManualBreak,
  endBreak,
  startBreak,
} from "@/features/attendance/service";
import { startTimer, stopTimer, updateEntry } from "@/features/activities/service";
import { markSynced } from "@/features/sheets-sync/service";

const { tasks, timeEntries } = schema;
const TZ = "Asia/Jakarta";

setupTestDb();

describe("daily-summary service against PGlite", () => {
  it("carries the task's own details on each time entry", async () => {
    const { userId, categoryId } = await seedBasics();
    const dueAt = new Date("2026-01-05T23:59:59Z");
    const [task] = await testDb
      .insert(tasks)
      .values({
        userId,
        name: "Detailed",
        categoryId,
        priority: "urgent",
        status: "review",
        description: "Notes here",
        dueAt,
        isFavorite: true,
      })
      .returning();
    await testDb.insert(timeEntries).values({
      userId,
      taskId: task.id,
      categoryId,
      startedAt: new Date("2026-01-05T02:00:00Z"),
      endedAt: new Date("2026-01-05T03:00:00Z"),
      status: "completed",
      source: "manual",
    });

    const summary = await getDaySummary(userId, "2026-01-05", TZ);
    expect(summary.timeEntries).toHaveLength(1);
    expect(summary.timeEntries[0].taskDetails).toEqual({
      categoryId,
      status: "review",
      priority: "urgent",
      description: "Notes here",
      dueAt: dueAt.toISOString(),
      isFavorite: true,
    });
  });
});

describe("getDaySummary needsSync", () => {
  // Future instants so DB-side `now()` defaults (real clock) are always
  // older than every faked app timestamp. 2030-03-04 08:00 local (UTC+7).
  const DAY = "2030-03-04";
  const T0 = new Date("2030-03-04T01:00:00Z");
  const T1 = new Date("2030-03-04T02:00:00Z");
  const T2 = new Date("2030-03-04T03:00:00Z");
  const minutesAfter = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("clock in on a fresh day → needsSync, never synced", async () => {
    const { userId } = await seedBasics();
    await clockIn(userId, TZ);
    const summary = await getDaySummary(userId, DAY, TZ);
    expect(summary.needsSync).toBe(true);
    expect(summary.lastSyncedAt).toBeNull();
  });

  it("markSynced clears needsSync and reports lastSyncedAt", async () => {
    const { userId } = await seedBasics();
    await clockIn(userId, TZ);
    vi.setSystemTime(T1);
    await markSynced(userId, DAY, { syncedAt: T1 });
    const summary = await getDaySummary(userId, DAY, TZ);
    expect(summary.needsSync).toBe(false);
    expect(summary.lastSyncedAt).toBe(T1.toISOString());
  });

  it("stopTimer after the sync → needsSync", async () => {
    const { userId, categoryId } = await seedBasics();
    await clockIn(userId, TZ);
    vi.setSystemTime(minutesAfter(T0, 5));
    await startTimer(userId, TZ, { taskName: "Build", categoryId });
    vi.setSystemTime(T1);
    await markSynced(userId, DAY, { syncedAt: T1 });
    expect((await getDaySummary(userId, DAY, TZ)).needsSync).toBe(false);
    vi.setSystemTime(T2);
    await stopTimer(userId, TZ);
    expect((await getDaySummary(userId, DAY, TZ)).needsSync).toBe(true);
  });

  it("updateEntry after the sync → needsSync", async () => {
    const { userId, categoryId } = await seedBasics();
    await clockIn(userId, TZ);
    vi.setSystemTime(minutesAfter(T0, 5));
    const entry = await startTimer(userId, TZ, { taskName: "Build", categoryId });
    vi.setSystemTime(minutesAfter(T0, 30));
    await stopTimer(userId, TZ);
    vi.setSystemTime(T1);
    await markSynced(userId, DAY, { syncedAt: T1 });
    expect((await getDaySummary(userId, DAY, TZ)).needsSync).toBe(false);
    vi.setSystemTime(T2);
    await updateEntry(userId, entry.id, { notes: "edited" }, TZ);
    expect((await getDaySummary(userId, DAY, TZ)).needsSync).toBe(true);
  });

  it("endBreak after the sync → needsSync", async () => {
    const { userId } = await seedBasics();
    await clockIn(userId, TZ);
    vi.setSystemTime(minutesAfter(T0, 10));
    await startBreak(userId, TZ);
    vi.setSystemTime(T1);
    await markSynced(userId, DAY, { syncedAt: T1 });
    expect((await getDaySummary(userId, DAY, TZ)).needsSync).toBe(false);
    vi.setSystemTime(T2);
    await endBreak(userId, TZ);
    expect((await getDaySummary(userId, DAY, TZ)).needsSync).toBe(true);
  });

  it("a manual break inside the span after the sync → needsSync", async () => {
    const { userId } = await seedBasics();
    await clockIn(userId, TZ);
    vi.setSystemTime(T1);
    await markSynced(userId, DAY, { syncedAt: T1 });
    expect((await getDaySummary(userId, DAY, TZ)).needsSync).toBe(false);
    vi.setSystemTime(T2);
    await createManualBreak(userId, TZ, {
      workDate: DAY,
      startedAt: minutesAfter(T0, 15),
      endedAt: minutesAfter(T0, 30),
    });
    expect((await getDaySummary(userId, DAY, TZ)).needsSync).toBe(true);
  });

  it("entries without an attendance row → not needsSync", async () => {
    const { userId, categoryId } = await seedBasics();
    const [task] = await testDb
      .insert(tasks)
      .values({ userId, name: "Orphan", categoryId })
      .returning();
    await testDb.insert(timeEntries).values({
      userId,
      taskId: task.id,
      categoryId,
      startedAt: minutesAfter(T0, 5),
      endedAt: minutesAfter(T0, 35),
      status: "completed",
      source: "manual",
      updatedAt: T2,
    });
    const summary = await getDaySummary(userId, DAY, TZ);
    expect(summary.timeEntries).toHaveLength(1);
    expect(summary.attendance).toBeNull();
    expect(summary.needsSync).toBe(false);
    expect(summary.lastSyncedAt).toBeNull();
  });
});
