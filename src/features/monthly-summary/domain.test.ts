import { describe, expect, it } from "vitest";
import { aggregateMonth, monthRange } from "./domain";
import type { CategoryTotalDTO, DaySummaryDTO } from "@/lib/types";

/**
 * Pure monthly aggregation tests. Fixtures are minimal valid DaySummaryDTO
 * shapes — everything the monthly domain needs and nothing more.
 */

const CATS: CategoryTotalDTO[] = [
  { categoryId: "c1", key: "website_management", name: "Website Management", minutes: 0 },
  { categoryId: "c2", key: "cyber_security", name: "Cyber Security", minutes: 0 },
  { categoryId: "c3", key: "technology_innovation", name: "Technology", minutes: 0 },
  { categoryId: "c4", key: "infrastructure_management", name: "Infrastructure", minutes: 0 },
  { categoryId: "c5", key: "research", name: "Research", minutes: 0 },
  { categoryId: "c6", key: "meeting", name: "Meeting", minutes: 0 },
  { categoryId: "c7", key: "training", name: "Training", minutes: 0 },
  { categoryId: "c8", key: "other_tasks", name: "Other Tasks", minutes: 0 },
];

/** Minimal day summary with the given totals/category minutes. */
function day(
  workDate: string,
  opts: {
    workMinutes?: number;
    breakMinutes?: number;
    attendanceMinutes?: number;
    attendance?: boolean;
    entries?: number;
    categoryMinutes?: Record<string, number>;
  } = {},
): DaySummaryDTO {
  const {
    workMinutes = 0,
    breakMinutes = 0,
    attendanceMinutes = 0,
    attendance = false,
    entries = 0,
    categoryMinutes = {},
  } = opts;
  return {
    workDate,
    attendance: attendance
      ? {
          id: `att-${workDate}`,
          workDate,
          clockInAt: "2026-09-02T01:45:00.000Z",
          clockOutAt: "2026-09-02T10:10:00.000Z",
          status: "closed",
          activeBreak: null,
          breaks: [],
          breakMinutes,
        }
      : null,
    timeEntries: Array.from({ length: entries }, (_, i) => ({
      id: `e-${workDate}-${i}`,
      taskId: "t1",
      taskName: "Task",
      categoryId: "c1",
      categoryKey: "website_management",
      categoryName: "Website Management",
      startedAt: "2026-09-02T02:00:00.000Z",
      endedAt: "2026-09-02T03:00:00.000Z",
      status: "completed",
      notes: null,
      source: "timer",
      durationMinutes: 60,
      pausedSeconds: 0,
      pausedAt: null,
    })),
    totals: { attendanceMinutes, breakMinutes, workMinutes },
    byCategory: CATS.map((c) => ({
      ...c,
      minutes: categoryMinutes[c.key] ?? 0,
    })),
    warnings: [],
    reviewState: "draft",
  };
}

describe("monthRange", () => {
  it("2026-09-15 (mid-month) resolves to 2026-09-01 .. 2026-09-30", () => {
    expect(monthRange("2026-09-15")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("the first day of a month maps to itself as the month start", () => {
    expect(monthRange("2026-09-01")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("the last day of a 30-day month maps to itself as the month end", () => {
    expect(monthRange("2026-09-30")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("2026-12-31 stays inside December at the year boundary", () => {
    expect(monthRange("2026-12-31")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
  });

  it("February in a non-leap year ends on the 28th", () => {
    expect(monthRange("2026-02-10")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("February in a leap year ends on the 29th", () => {
    expect(monthRange("2028-02-10")).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });
});

describe("aggregateMonth", () => {
  it("zero-fills every day of a 31-day month in order from partial input", () => {
    const month = aggregateMonth(
      [day("2026-12-15", { attendance: true })],
      { from: "2026-12-01", to: "2026-12-31" },
    );
    expect(month.days).toHaveLength(31);
    expect(month.days[0]?.workDate).toBe("2026-12-01");
    expect(month.days[30]?.workDate).toBe("2026-12-31");
    expect(month.days.filter((d) => d.hasData)).toHaveLength(1);
    expect(month.totals.daysTracked).toBe(1);
  });

  it("zero-fills a short February (28 days) with no summaries", () => {
    const month = aggregateMonth([], { from: "2026-02-01", to: "2026-02-28" });
    expect(month.days).toHaveLength(28);
    expect(month.days.every((d) => !d.hasData && d.workMinutes === 0)).toBe(true);
    expect(month.totals.daysTracked).toBe(0);
  });

  it("sums work, break, and attendance minutes across days", () => {
    const month = aggregateMonth(
      [
        day("2026-09-02", {
          workMinutes: 120,
          breakMinutes: 30,
          attendanceMinutes: 300,
          attendance: true,
        }),
        day("2026-09-03", {
          workMinutes: 60,
          breakMinutes: 15,
          attendanceMinutes: 120,
          attendance: true,
        }),
      ],
      { from: "2026-09-01", to: "2026-09-30" },
    );
    expect(month.totals.workMinutes).toBe(180);
    expect(month.totals.breakMinutes).toBe(45);
    expect(month.totals.attendanceMinutes).toBe(420);
  });

  it("daysTracked counts only days with data", () => {
    const month = aggregateMonth(
      [
        day("2026-09-01", { attendance: true }),
        day("2026-09-05", { entries: 2 }),
        day("2026-09-07", { entries: 1 }),
      ],
      { from: "2026-09-01", to: "2026-09-30" },
    );
    expect(month.totals.daysTracked).toBe(3);
  });

  it("hasData is true when attendance exists OR entries exist", () => {
    const month = aggregateMonth(
      [
        day("2026-09-01", { attendance: true }),
        day("2026-09-02", { entries: 1 }),
        day("2026-09-03"), // neither → false
      ],
      { from: "2026-09-01", to: "2026-09-30" },
    );
    expect(month.days[0]?.hasData).toBe(true);
    expect(month.days[1]?.hasData).toBe(true);
    expect(month.days[2]?.hasData).toBe(false);
  });

  it("per-day rows carry that day's minutes and preserve range order", () => {
    const month = aggregateMonth(
      [day("2026-09-10", { workMinutes: 90, breakMinutes: 20, attendance: true })],
      { from: "2026-09-01", to: "2026-09-30" },
    );
    const row = month.days.find((d) => d.workDate === "2026-09-10");
    expect(row).toMatchObject({
      workMinutes: 90,
      breakMinutes: 20,
      attendanceMinutes: 0,
      hasData: true,
    });
    // Days before the single summary are zero-filled
    expect(month.days[0]?.workMinutes).toBe(0);
    expect(month.days[0]?.hasData).toBe(false);
  });

  it("sums category minutes across days, keeping all 8 with zeros in input order", () => {
    const month = aggregateMonth(
      [
        day("2026-09-02", {
          attendance: true,
          categoryMinutes: { website_management: 60, research: 30 },
        }),
        day("2026-09-03", {
          attendance: true,
          categoryMinutes: { website_management: 45, meeting: 15 },
        }),
      ],
      { from: "2026-09-01", to: "2026-09-30" },
    );
    expect(month.byCategory).toHaveLength(8);
    expect(month.byCategory.map((c) => c.key)).toEqual(CATS.map((c) => c.key));
    expect(month.byCategory.find((c) => c.key === "website_management")?.minutes).toBe(105);
    expect(month.byCategory.find((c) => c.key === "research")?.minutes).toBe(30);
    expect(month.byCategory.find((c) => c.key === "meeting")?.minutes).toBe(15);
    // untouched categories stay at zero and are still present
    expect(month.byCategory.find((c) => c.key === "training")?.minutes).toBe(0);
  });

  it("ignores summaries outside the range (before from and after to)", () => {
    const month = aggregateMonth(
      [
        day("2026-08-31", { workMinutes: 999, attendance: true }), // day before
        day("2026-10-01", { workMinutes: 999, attendance: true }), // day after
      ],
      { from: "2026-09-01", to: "2026-09-30" },
    );
    expect(month.totals.workMinutes).toBe(0);
    expect(month.totals.daysTracked).toBe(0);
    expect(month.days.every((d) => !d.hasData)).toBe(true);
  });

  it("empty category list in input yields an empty byCategory (no phantom keys)", () => {
    const emptyCats = day("2026-09-02", { attendance: true });
    const month = aggregateMonth([{ ...emptyCats, byCategory: [] }], {
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(month.byCategory).toEqual([]);
  });
});
