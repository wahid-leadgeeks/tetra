import { describe, expect, it } from "vitest";
import { aggregateWeek, weekRange } from "./domain";
import type { CategoryTotalDTO, DaySummaryDTO } from "@/lib/types";

/**
 * Pure weekly aggregation tests. Fixtures are minimal valid DaySummaryDTO
 * shapes — everything the weekly domain needs and nothing more.
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

describe("weekRange", () => {
  it("2026-09-04 (Friday) resolves to Monday 2026-08-31 .. Sunday 2026-09-06", () => {
    expect(weekRange("2026-09-04")).toEqual({
      from: "2026-08-31",
      to: "2026-09-06",
    });
  });

  it("a Monday input maps to itself as the week start", () => {
    expect(weekRange("2026-08-31")).toEqual({
      from: "2026-08-31",
      to: "2026-09-06",
    });
  });

  it("a Sunday input maps to itself as the week end", () => {
    expect(weekRange("2026-09-06")).toEqual({
      from: "2026-08-31",
      to: "2026-09-06",
    });
  });

  it("crosses month and year boundaries", () => {
    // 2027-01-01 is a Friday; its Monday is 2026-12-28.
    expect(weekRange("2027-01-01")).toEqual({
      from: "2026-12-28",
      to: "2027-01-03",
    });
  });
});

describe("aggregateWeek", () => {
  it("zero-fills all seven days of the range in order when no summaries exist", () => {
    const week = aggregateWeek([], { from: "2026-08-31", to: "2026-09-06" });
    expect(week.days).toHaveLength(7);
    expect(week.days.map((d) => d.workDate)).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ]);
    expect(week.days.every((d) => !d.hasData && d.workMinutes === 0)).toBe(true);
    expect(week.totals.daysTracked).toBe(0);
  });

  it("sums work, break, and attendance minutes across days", () => {
    const week = aggregateWeek(
      [
        day("2026-08-31", {
          workMinutes: 120,
          breakMinutes: 30,
          attendanceMinutes: 300,
          attendance: true,
        }),
        day("2026-09-01", {
          workMinutes: 60,
          breakMinutes: 15,
          attendanceMinutes: 120,
          attendance: true,
        }),
      ],
      { from: "2026-08-31", to: "2026-09-06" },
    );
    expect(week.totals.workMinutes).toBe(180);
    expect(week.totals.breakMinutes).toBe(45);
    expect(week.totals.attendanceMinutes).toBe(420);
  });

  it("daysTracked counts only days with data", () => {
    const week = aggregateWeek(
      [
        day("2026-08-31", { attendance: true }),
        day("2026-09-02", { entries: 2 }),
        // 2026-09-04 has data via entries only, not attendance
        day("2026-09-04", { entries: 1 }),
      ],
      { from: "2026-08-31", to: "2026-09-06" },
    );
    expect(week.totals.daysTracked).toBe(3);
  });

  it("hasData is true when attendance exists OR entries exist", () => {
    const week = aggregateWeek(
      [
        day("2026-08-31", { attendance: true }),
        day("2026-09-01", { entries: 1 }),
        day("2026-09-02"), // neither → false
      ],
      { from: "2026-08-31", to: "2026-09-06" },
    );
    expect(week.days[0]?.hasData).toBe(true);
    expect(week.days[1]?.hasData).toBe(true);
    expect(week.days[2]?.hasData).toBe(false);
  });

  it("per-day rows carry that day's minutes and preserve range order", () => {
    const week = aggregateWeek(
      [day("2026-09-03", { workMinutes: 90, breakMinutes: 20, attendance: true })],
      { from: "2026-08-31", to: "2026-09-06" },
    );
    const wed = week.days.find((d) => d.workDate === "2026-09-03");
    expect(wed).toMatchObject({
      workMinutes: 90,
      breakMinutes: 20,
      attendanceMinutes: 0,
      hasData: true,
    });
    // Mon + Tue (before the single summary) are zero-filled
    expect(week.days[0]?.workMinutes).toBe(0);
    expect(week.days[1]?.hasData).toBe(false);
  });

  it("sums category minutes across days, keeping all 8 in input order", () => {
    const week = aggregateWeek(
      [
        day("2026-08-31", {
          attendance: true,
          categoryMinutes: { website_management: 60, research: 30 },
        }),
        day("2026-09-01", {
          attendance: true,
          categoryMinutes: { website_management: 45, meeting: 15 },
        }),
      ],
      { from: "2026-08-31", to: "2026-09-06" },
    );
    expect(week.byCategory).toHaveLength(8);
    expect(week.byCategory.map((c) => c.key)).toEqual(CATS.map((c) => c.key));
    expect(week.byCategory.find((c) => c.key === "website_management")?.minutes).toBe(105);
    expect(week.byCategory.find((c) => c.key === "research")?.minutes).toBe(30);
    expect(week.byCategory.find((c) => c.key === "meeting")?.minutes).toBe(15);
    // untouched categories stay at zero and are still present
    expect(week.byCategory.find((c) => c.key === "training")?.minutes).toBe(0);
  });

  it("ignores summaries outside the range", () => {
    const week = aggregateWeek(
      [
        day("2026-08-30", { workMinutes: 999, attendance: true }), // Sunday before
        day("2026-09-07", { workMinutes: 999, attendance: true }), // Monday after
      ],
      { from: "2026-08-31", to: "2026-09-06" },
    );
    expect(week.totals.workMinutes).toBe(0);
    expect(week.totals.daysTracked).toBe(0);
    expect(week.days.every((d) => !d.hasData)).toBe(true);
  });

  it("empty category list in input yields an empty byCategory (no phantom keys)", () => {
    const emptyCats = day("2026-08-31", { attendance: true });
    const week = aggregateWeek([{ ...emptyCats, byCategory: [] }], {
      from: "2026-08-31",
      to: "2026-09-06",
    });
    expect(week.byCategory).toEqual([]);
  });
});
