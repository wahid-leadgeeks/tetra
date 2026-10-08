import { describe, expect, it, vi, beforeEach } from "vitest";
import { schema } from "@/server/db";
import { seedBasics, testDb, setupTestDb } from "@/test/pglite-db";
import { DEFAULT_SHEET_MAPPING } from "./mapping";

const sheetsApi = vi.hoisted(() => ({
  get: vi.fn(),
  batchGet: vi.fn(),
}));

vi.mock("@/server/db", async () => (await import("@/test/pglite-db")).dbModuleMock());
vi.mock("./google", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./google")>()),
  getSheetsClient: vi.fn(async () => ({
    spreadsheets: { values: { get: sheetsApi.get, batchGet: sheetsApi.batchGet } },
  })),
}));
vi.mock("./config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./config")>()),
  getSyncConfig: vi.fn(async () => ({
    id: "cfg-1",
    spreadsheetId: "test-sheet-copy",
    worksheetName: "Sheet1",
    sheetGid: null,
    mapping: DEFAULT_SHEET_MAPPING,
    timezone: "Asia/Jakarta",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })),
}));

import { pullDayFromSheet } from "./pull";
import { getDaySummary } from "@/features/daily-summary/service";

const { categories, dailyAttendance, timeEntries } = schema;
const DAY = "2026-01-05";

setupTestDb();

beforeEach(() => {
  sheetsApi.get.mockReset();
  sheetsApi.batchGet.mockReset();
});

/** Fake sheet: header row 1, the target date on row 3 (B..E times, H/I research, R/S meeting). */
function stubSheet() {
  sheetsApi.get.mockResolvedValue({
    data: { values: [["Date"], ["2026-01-04"], [DAY]] },
  });
  sheetsApi.batchGet.mockImplementation(async ({ ranges }: { ranges: string[] }) => {
    const byCell: Record<string, string> = {
      B3: "08:30",
      C3: "12:00",
      D3: "13:00",
      E3: "17:30",
      P3: "2:00",
      Q3: "Read papers",
      R3: "1:00",
      S3: "Standup",
    };
    return {
      data: {
        valueRanges: ranges.map((range) => {
          const cell = range.split("!")[1];
          const value = byCell[cell];
          return value === undefined ? {} : { values: [[value]] };
        }),
      },
    };
  });
}

describe("pullDayFromSheet sync-state stamps", () => {
  it("a pulled day with no prior attendance is not newer than last_synced_at", async () => {
    const { userId } = await seedBasics();
    await testDb.insert(categories).values([
      { key: "research", name: "Research" },
      { key: "meeting", name: "Meeting" },
    ]);
    stubSheet();

    await pullDayFromSheet(userId, DAY);

    const [att] = await testDb.select().from(dailyAttendance);
    expect(att.workDate).toBe(DAY);
    expect(att.lastSyncedAt).not.toBeNull();
    const syncedAt = att.lastSyncedAt!.getTime();
    expect(att.updatedAt.getTime()).toBeLessThanOrEqual(syncedAt);

    const entries = await testDb.select().from(timeEntries);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.updatedAt.getTime()).toBeLessThanOrEqual(syncedAt);
    }

    const summary = await getDaySummary(userId, DAY, "Asia/Jakarta");
    expect(summary.needsSync).toBe(false);
    expect(summary.lastSyncedAt).toBe(att.lastSyncedAt!.toISOString());
  });
});
