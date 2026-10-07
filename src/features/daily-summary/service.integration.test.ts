import { describe, expect, it, vi } from "vitest";
import { schema } from "@/server/db";
import { seedBasics, setupTestDb, testDb } from "@/test/pglite-db";

vi.mock("@/server/db", async () => (await import("@/test/pglite-db")).dbModuleMock());

import { getDaySummary } from "./service";

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
