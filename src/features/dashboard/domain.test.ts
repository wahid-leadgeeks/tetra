import { describe, expect, it } from "vitest";
import {
  aggregateMonthWeekSlices,
  buildDailyProgressDTO,
  buildDashboardDTO,
  buildMonthlyProgressDTO,
  buildWeeklyProgressDTO,
  calculateProgressPct,
  countWorkdays,
  expectedMinutesSoFar,
  formatDiffHuman,
  formatDiffMinutes,
  formatMonthLabel,
  formatSliceDateRange,
  getISOWeekNumber,
  partitionMonthIntoWeekSlices,
} from "./domain";
import type { CategoryTotalDTO, DaySummaryDTO } from "@/lib/types";

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

function createDaySummary(
  workDate: string,
  opts: {
    workMinutes?: number;
    breakMinutes?: number;
    attendanceMinutes?: number;
    hasAttendance?: boolean;
    categoryMinutes?: Record<string, number>;
  } = {},
): DaySummaryDTO {
  const {
    workMinutes = 0,
    breakMinutes = 0,
    attendanceMinutes = 0,
    hasAttendance = false,
    categoryMinutes = {},
  } = opts;

  return {
    workDate,
    attendance: hasAttendance
      ? {
          id: `att-${workDate}`,
          workDate,
          clockInAt: `${workDate}T08:30:00.000Z`,
          clockOutAt: `${workDate}T17:00:00.000Z`,
          status: "closed",
          activeBreak: null,
          breaks: [],
          breakMinutes,
        }
      : null,
    timeEntries:
      workMinutes > 0
        ? [
            {
              id: `entry-${workDate}`,
              taskId: "t1",
              taskName: "Task",
              categoryId: "c1",
              categoryKey: "website_management",
              categoryName: "Website Management",
              startedAt: `${workDate}T09:00:00.000Z`,
              endedAt: `${workDate}T17:00:00.000Z`,
              status: "completed",
              notes: null,
              source: "timer",
              durationMinutes: workMinutes,
              pausedSeconds: 0,
              pausedAt: null,
            },
          ]
        : [],
    totals: { attendanceMinutes, breakMinutes, workMinutes },
    byCategory: CATS.map((c) => ({
      ...c,
      minutes: categoryMinutes[c.key] ?? 0,
    })),
    warnings: [],
    reviewState: "ready",
  };
}

/* ========================================================================== */
/* 1. formatDiffMinutes                                                       */
/* ========================================================================== */
describe("formatDiffMinutes", () => {
  it("formats exact zero diff cleanly without sign", () => {
    const res = formatDiffMinutes(0);
    expect(res).toEqual({
      formatted: "0:00",
      isAhead: false,
      isBehind: false,
      isExact: true,
    });
  });

  it("handles JavaScript -0 without producing -0:00", () => {
    const res = formatDiffMinutes(-0);
    expect(res).toEqual({
      formatted: "0:00",
      isAhead: false,
      isBehind: false,
      isExact: true,
    });
  });

  it("formats positive diffs with '+' prefix and padded minutes", () => {
    expect(formatDiffMinutes(1)).toEqual({
      formatted: "+0:01",
      isAhead: true,
      isBehind: false,
      isExact: false,
    });
    expect(formatDiffMinutes(9).formatted).toBe("+0:09");
    expect(formatDiffMinutes(15).formatted).toBe("+0:15");
    expect(formatDiffMinutes(59).formatted).toBe("+0:59");
    expect(formatDiffMinutes(60).formatted).toBe("+1:00");
    expect(formatDiffMinutes(75).formatted).toBe("+1:15");
    expect(formatDiffMinutes(480).formatted).toBe("+8:00");
    expect(formatDiffMinutes(2400).formatted).toBe("+40:00");
    expect(formatDiffMinutes(6000).formatted).toBe("+100:00");
  });

  it("formats negative diffs with '-' prefix and padded minutes", () => {
    expect(formatDiffMinutes(-1)).toEqual({
      formatted: "-0:01",
      isAhead: false,
      isBehind: true,
      isExact: false,
    });
    expect(formatDiffMinutes(-9).formatted).toBe("-0:09");
    expect(formatDiffMinutes(-15).formatted).toBe("-0:15");
    expect(formatDiffMinutes(-59).formatted).toBe("-0:59");
    expect(formatDiffMinutes(-60).formatted).toBe("-1:00");
    expect(formatDiffMinutes(-75).formatted).toBe("-1:15");
    expect(formatDiffMinutes(-480).formatted).toBe("-8:00");
    expect(formatDiffMinutes(-2040).formatted).toBe("-34:00"); // Sep 2026 Week 2
    expect(formatDiffMinutes(-2400).formatted).toBe("-40:00"); // Sep 2026 Week 3 & 4
    expect(formatDiffMinutes(-1440).formatted).toBe("-24:00"); // Sep 2026 Week 5
    expect(formatDiffMinutes(-8280).formatted).toBe("-138:00"); // Sep 2026 Total Month
  });
});

/* ========================================================================== */
/* 2. calculateProgressPct                                                    */
/* ========================================================================== */
describe("calculateProgressPct", () => {
  it("returns 0 when target is 0 and work is 0", () => {
    expect(calculateProgressPct(0, 0)).toBe(0);
  });

  it("handles zero target safely when work is greater than 0", () => {
    expect(calculateProgressPct(120, 0)).toBe(100);
  });

  it("returns 0 when work is 0 and target is positive", () => {
    expect(calculateProgressPct(0, 480)).toBe(0);
    expect(calculateProgressPct(0, 2400)).toBe(0);
  });

  it("calculates accurate percentages for partial completion", () => {
    expect(calculateProgressPct(120, 480)).toBe(25);
    expect(calculateProgressPct(240, 480)).toBe(50);
    expect(calculateProgressPct(360, 480)).toBe(75);
    expect(calculateProgressPct(360, 2400)).toBe(15); // Sep 2026 Week 2: 6h / 40h = 15%
    expect(calculateProgressPct(2280, 10560)).toBe(22); // Sep 2026 Month: 38h / 176h = 21.59% -> 22%
  });

  it("returns 100 when target is exactly met", () => {
    expect(calculateProgressPct(480, 480)).toBe(100);
    expect(calculateProgressPct(1920, 1920)).toBe(100); // Sep 2026 Week 1: 32h / 32h
  });

  it("handles overflow greater than 100% when unclamped", () => {
    expect(calculateProgressPct(600, 480)).toBe(125);
  });

  it("clamps at 100% when clamp option is enabled", () => {
    expect(calculateProgressPct(600, 480, { clamp: true })).toBe(100);
  });

  it("guards against negative input values", () => {
    expect(calculateProgressPct(-60, 480)).toBe(0);
  });
});

/* ========================================================================== */
/* 3. partitionMonthIntoWeekSlices                                            */
/* ========================================================================== */
describe("partitionMonthIntoWeekSlices", () => {
  describe("September 2026 (Official Google Sheet Benchmark)", () => {
    it("partitions September 2026 into 5 week slices matching official targets exactly", () => {
      const slices = partitionMonthIntoWeekSlices("2026-09");

      expect(slices).toHaveLength(5);

      // Week 1: Tue Sep 1 – Sun Sep 6 (4 workdays = 32:00)
      expect(slices[0]).toMatchObject({
        weekIndex: 1,
        label: "WEEK 1",
        from: "2026-09-01",
        to: "2026-09-06",
        workdaysCount: 4,
        targetMinutes: 1920, // 32 hours
      });

      // Week 2: Mon Sep 7 – Sun Sep 13 (5 workdays = 40:00)
      expect(slices[1]).toMatchObject({
        weekIndex: 2,
        label: "WEEK 2",
        from: "2026-09-07",
        to: "2026-09-13",
        workdaysCount: 5,
        targetMinutes: 2400, // 40 hours
      });

      // Week 3: Mon Sep 14 – Sun Sep 20 (5 workdays = 40:00)
      expect(slices[2]).toMatchObject({
        weekIndex: 3,
        label: "WEEK 3",
        from: "2026-09-14",
        to: "2026-09-20",
        workdaysCount: 5,
        targetMinutes: 2400, // 40 hours
      });

      // Week 4: Mon Sep 21 – Sun Sep 27 (5 workdays = 40:00)
      expect(slices[3]).toMatchObject({
        weekIndex: 4,
        label: "WEEK 4",
        from: "2026-09-21",
        to: "2026-09-27",
        workdaysCount: 5,
        targetMinutes: 2400, // 40 hours
      });

      // Week 5: Mon Sep 28 – Wed Sep 30 (3 workdays = 24:00)
      expect(slices[4]).toMatchObject({
        weekIndex: 5,
        label: "WEEK 5",
        from: "2026-09-28",
        to: "2026-09-30",
        workdaysCount: 3,
        targetMinutes: 1440, // 24 hours
      });

      // Aggregate totals verification
      const totalWorkdays = slices.reduce((sum, s) => sum + s.workdaysCount, 0);
      const totalTargetMinutes = slices.reduce((sum, s) => sum + s.targetMinutes, 0);
      expect(totalWorkdays).toBe(22);
      expect(totalTargetMinutes).toBe(10560); // 176 hours
    });

    it("accepts full day key (YYYY-MM-DD) as input and derives month slices", () => {
      const slices = partitionMonthIntoWeekSlices("2026-09-15");
      expect(slices).toHaveLength(5);
      expect(slices[0]?.from).toBe("2026-09-01");
      expect(slices[4]?.to).toBe("2026-09-30");
    });
  });

  describe("Month Boundary Edge Cases", () => {
    it("handles month starting on Sunday (March 2026) yielding 6 slices with zero-target Week 1", () => {
      const slices = partitionMonthIntoWeekSlices("2026-03");
      expect(slices).toHaveLength(6);

      // Week 1 is single Sunday (Mar 1)
      expect(slices[0]).toMatchObject({
        weekIndex: 1,
        from: "2026-03-01",
        to: "2026-03-01",
        workdaysCount: 0,
        targetMinutes: 0,
      });

      // Weeks 2 to 5: 4 full weeks of 5 workdays each
      for (let i = 1; i <= 4; i++) {
        expect(slices[i]).toMatchObject({
          workdaysCount: 5,
          targetMinutes: 2400,
        });
      }

      // Week 6: Mon Mar 30 – Tue Mar 31 (2 workdays)
      expect(slices[5]).toMatchObject({
        weekIndex: 6,
        from: "2026-03-30",
        to: "2026-03-31",
        workdaysCount: 2,
        targetMinutes: 960,
      });

      const totalTarget = slices.reduce((s, c) => s + c.targetMinutes, 0);
      expect(totalTarget).toBe(10560); // 22 workdays = 176h
    });

    it("handles month starting on Saturday (August 2026) yielding 6 slices", () => {
      const slices = partitionMonthIntoWeekSlices("2026-08");
      expect(slices).toHaveLength(6);

      // Week 1: Sat Aug 1 – Sun Aug 2 (0 workdays)
      expect(slices[0]).toMatchObject({
        weekIndex: 1,
        from: "2026-08-01",
        to: "2026-08-02",
        workdaysCount: 0,
        targetMinutes: 0,
      });

      // Week 6: Mon Aug 31 – Mon Aug 31 (1 workday = 8h)
      expect(slices[5]).toMatchObject({
        weekIndex: 6,
        from: "2026-08-31",
        to: "2026-08-31",
        workdaysCount: 1,
        targetMinutes: 480,
      });

      const totalWorkdays = slices.reduce((s, c) => s + c.workdaysCount, 0);
      expect(totalWorkdays).toBe(21); // 21 workdays = 168h
    });

    it("handles an exact 4-week month (February 2021 non-leap starting on Monday)", () => {
      const slices = partitionMonthIntoWeekSlices("2021-02");
      expect(slices).toHaveLength(4);

      expect(slices[0]).toMatchObject({
        weekIndex: 1,
        from: "2021-02-01",
        to: "2021-02-07",
        workdaysCount: 5,
        targetMinutes: 2400,
      });

      expect(slices[3]).toMatchObject({
        weekIndex: 4,
        from: "2021-02-22",
        to: "2021-02-28",
        workdaysCount: 5,
        targetMinutes: 2400,
      });

      const totalWorkdays = slices.reduce((s, c) => s + c.workdaysCount, 0);
      expect(totalWorkdays).toBe(20); // 160h
    });

    it("handles non-leap February starting on Sunday (February 2026) yielding 5 slices", () => {
      const slices = partitionMonthIntoWeekSlices("2026-02");
      expect(slices).toHaveLength(5);

      // Week 1: Sun Feb 1 (0 workdays)
      expect(slices[0]).toMatchObject({
        weekIndex: 1,
        from: "2026-02-01",
        to: "2026-02-01",
        workdaysCount: 0,
        targetMinutes: 0,
      });

      // Week 5: Mon Feb 23 – Sat Feb 28 (5 workdays, Mon-Fri)
      expect(slices[4]).toMatchObject({
        weekIndex: 5,
        from: "2026-02-23",
        to: "2026-02-28",
        workdaysCount: 5,
        targetMinutes: 2400,
      });

      const totalWorkdays = slices.reduce((s, c) => s + c.workdaysCount, 0);
      expect(totalWorkdays).toBe(20);
    });

    it("handles leap year February (February 2028: 29 days)", () => {
      const slices = partitionMonthIntoWeekSlices("2028-02");
      expect(slices).toHaveLength(5);

      // 2028-02-01 is Tue -> Week 1 has 4 workdays
      expect(slices[0]).toMatchObject({
        weekIndex: 1,
        from: "2028-02-01",
        to: "2028-02-06",
        workdaysCount: 4,
        targetMinutes: 1920,
      });

      // 2028-02-29 is Tue -> Week 5 has 2 workdays
      expect(slices[4]).toMatchObject({
        weekIndex: 5,
        from: "2028-02-28",
        to: "2028-02-29",
        workdaysCount: 2,
        targetMinutes: 960,
      });

      const totalWorkdays = slices.reduce((s, c) => s + c.workdaysCount, 0);
      expect(totalWorkdays).toBe(21); // 168h
    });

    it("confines year boundary months strictly within their calendar year", () => {
      const dec = partitionMonthIntoWeekSlices("2026-12");
      expect(dec[dec.length - 1]?.to).toBe("2026-12-31");

      const jan = partitionMonthIntoWeekSlices("2027-01");
      expect(jan[0]?.from).toBe("2027-01-01");
    });
  });
});

/* ========================================================================== */
/* 4. aggregateMonthWeekSlices                                                */
/* ========================================================================== */
describe("aggregateMonthWeekSlices", () => {
  it("reproduces the exact Personal Weekly Report table data from Google Sheet", () => {
    const slices = partitionMonthIntoWeekSlices("2026-09");

    // Construct mock day summaries reflecting Image 2:
    // Week 1 (Sep 1-4): 4 days logged with 8h (480 min) each = 32:00
    // Week 2 (Sep 7): 1 day logged with 6h (360 min) = 06:00
    // Remaining days: 0 logged
    const summaries: DaySummaryDTO[] = [
      createDaySummary("2026-09-01", { workMinutes: 480, hasAttendance: true }),
      createDaySummary("2026-09-02", { workMinutes: 480, hasAttendance: true }),
      createDaySummary("2026-09-03", { workMinutes: 480, hasAttendance: true }),
      createDaySummary("2026-09-04", { workMinutes: 480, hasAttendance: true }),
      createDaySummary("2026-09-07", { workMinutes: 360, hasAttendance: true }),
    ];

    const aggregated = aggregateMonthWeekSlices(slices, summaries);

    // Week 1: Target 32:00, Logged 32:00, Diff 0:00, Progress 100%
    expect(aggregated[0]).toMatchObject({
      label: "WEEK 1",
      workdaysCount: 4,
      targetMinutes: 1920,
      workMinutes: 1920,
      diffMinutes: 0,
      formattedDiff: { formatted: "0:00", isExact: true },
      progressPct: 100,
    });

    // Week 2: Target 40:00, Logged 06:00, Diff -34:00, Progress 15%
    expect(aggregated[1]).toMatchObject({
      label: "WEEK 2",
      workdaysCount: 5,
      targetMinutes: 2400,
      workMinutes: 360,
      diffMinutes: -2040,
      formattedDiff: { formatted: "-34:00", isBehind: true },
      progressPct: 15,
    });

    // Week 3: Target 40:00, Logged 0:00, Diff -40:00, Progress 0%
    expect(aggregated[2]).toMatchObject({
      label: "WEEK 3",
      targetMinutes: 2400,
      workMinutes: 0,
      diffMinutes: -2400,
      formattedDiff: { formatted: "-40:00", isBehind: true },
      progressPct: 0,
    });

    // Week 4: Target 40:00, Logged 0:00, Diff -40:00, Progress 0%
    expect(aggregated[3]).toMatchObject({
      label: "WEEK 4",
      targetMinutes: 2400,
      workMinutes: 0,
      diffMinutes: -2400,
      formattedDiff: { formatted: "-40:00", isBehind: true },
      progressPct: 0,
    });

    // Week 5: Target 24:00, Logged 0:00, Diff -24:00, Progress 0%
    expect(aggregated[4]).toMatchObject({
      label: "WEEK 5",
      targetMinutes: 1440,
      workMinutes: 0,
      diffMinutes: -1440,
      formattedDiff: { formatted: "-24:00", isBehind: true },
      progressPct: 0,
    });
  });

  it("correctly credits work logged on weekend days into that week slice", () => {
    const slices = partitionMonthIntoWeekSlices("2026-09");
    const summaries = [
      createDaySummary("2026-09-05", { workMinutes: 120, hasAttendance: true }), // Saturday
    ];

    const aggregated = aggregateMonthWeekSlices(slices, summaries);
    expect(aggregated[0]?.workMinutes).toBe(120);
    expect(aggregated[0]?.diffMinutes).toBe(120 - 1920); // -1800 (-30:00)
  });

  it("ignores day summaries outside the month range", () => {
    const slices = partitionMonthIntoWeekSlices("2026-09");
    const summaries = [
      createDaySummary("2026-08-31", { workMinutes: 480 }), // Day before
      createDaySummary("2026-10-01", { workMinutes: 480 }), // Day after
    ];

    const aggregated = aggregateMonthWeekSlices(slices, summaries);
    const totalLogged = aggregated.reduce((s, w) => s + w.workMinutes, 0);
    expect(totalLogged).toBe(0);
  });
});

/* ========================================================================== */
/* 5. buildDailyProgressDTO                                                   */
/* ========================================================================== */
describe("buildDailyProgressDTO", () => {
  it("builds daily progress for a standard workday with 8h target", () => {
    const summary = createDaySummary("2026-09-02", {
      workMinutes: 510,
      breakMinutes: 45,
      attendanceMinutes: 555,
      hasAttendance: true,
      categoryMinutes: { website_management: 300, meeting: 210 },
    });

    const dto = buildDailyProgressDTO(summary, "2026-09-02");

    expect(dto).toMatchObject({
      date: "2026-09-02",
      isWorkday: true,
      workMinutes: 510,
      breakMinutes: 45,
      targetMinutes: 480,
      diffMinutes: 30,
      formattedDiff: { formatted: "+0:30", isAhead: true },
      progressPct: 106,
    });
    expect(dto.categoryBreakdown.find((c) => c.key === "website_management")?.minutes).toBe(300);
  });

  it("builds daily progress for a weekend day with 0 target", () => {
    const summary = createDaySummary("2026-09-06", { workMinutes: 60, hasAttendance: true });
    const dto = buildDailyProgressDTO(summary, "2026-09-06");

    expect(dto.isWorkday).toBe(false);
    expect(dto.targetMinutes).toBe(0);
    expect(dto.diffMinutes).toBe(60);
    expect(dto.formattedDiff.formatted).toBe("+1:00");
  });

  it("handles null summary on a workday as zero work and -8:00 diff", () => {
    const dto = buildDailyProgressDTO(null, "2026-09-02");

    expect(dto).toMatchObject({
      date: "2026-09-02",
      isWorkday: true,
      workMinutes: 0,
      breakMinutes: 0,
      targetMinutes: 480,
      diffMinutes: -480,
      formattedDiff: { formatted: "-8:00", isBehind: true },
      progressPct: 0,
    });
  });
});

/* ========================================================================== */
/* 6. buildWeeklyProgressDTO & buildMonthlyProgressDTO                        */
/* ========================================================================== */
describe("buildWeeklyProgressDTO", () => {
  it("structures Monday-Sunday progress including day status and week totals", () => {
    const days = [
      createDaySummary("2026-09-07", { workMinutes: 480, hasAttendance: true }),
      createDaySummary("2026-09-08", { workMinutes: 240, hasAttendance: true }),
    ];

    const dto = buildWeeklyProgressDTO({
      from: "2026-09-07",
      to: "2026-09-13",
      days,
    });

    expect(dto.days).toHaveLength(7);
    expect(dto.targetMinutes).toBe(2400); // 5 workdays * 480
    expect(dto.totalWorkMinutes).toBe(720);
    expect(dto.diffMinutes).toBe(-1680);
    expect(dto.formattedDiff.formatted).toBe("-28:00");
    expect(dto.progressPct).toBe(30);
  });
});

describe("buildMonthlyProgressDTO", () => {
  it("assembles month aggregate, category totals, and Personal Weekly Report table", () => {
    const slices = partitionMonthIntoWeekSlices("2026-09");
    const summaries = [
      createDaySummary("2026-09-01", { workMinutes: 1920, hasAttendance: true }),
      createDaySummary("2026-09-07", { workMinutes: 360, hasAttendance: true }),
    ];
    const weekSlices = aggregateMonthWeekSlices(slices, summaries);

    const dto = buildMonthlyProgressDTO({
      monthKey: "2026-09",
      weekSlices,
      summaries,
    });

    expect(dto.totalTargetMinutes).toBe(10560); // 176:00
    expect(dto.totalWorkMinutes).toBe(2280); // 38:00
    expect(dto.totalDiffMinutes).toBe(-8280); // -138:00
    expect(dto.formattedDiff.formatted).toBe("-138:00");
    expect(dto.progressPct).toBe(22);
    expect(dto.weekSlices).toHaveLength(5);
  });
});

/* ========================================================================== */
/* 7. buildDashboardDTO                                                       */
/* ========================================================================== */
describe("buildDashboardDTO", () => {
  it("integrates daily, weekly, and monthly sections coherently", () => {
    const slices = partitionMonthIntoWeekSlices("2026-09");
    const summaries = [
      createDaySummary("2026-09-08", { workMinutes: 480, hasAttendance: true }),
    ];
    const weekSlices = aggregateMonthWeekSlices(slices, summaries);

    const dto = buildDashboardDTO({
      anchorDate: "2026-09-08",
      timezone: "Asia/Jakarta",
      daySummary: summaries[0]!,
      weekSummary: {
        from: "2026-09-07",
        to: "2026-09-13",
        days: summaries,
      },
      monthSummary: {
        monthKey: "2026-09",
        weekSlices,
        summaries,
      },
    });

    expect(dto.anchorDate).toBe("2026-09-08");
    expect(dto.timezone).toBe("Asia/Jakarta");
    expect(dto.daily.workMinutes).toBe(480);
    expect(dto.weekly.from).toBe("2026-09-07");
    expect(dto.monthly.monthKey).toBe("2026-09");
    expect(dto.monthly.totalTargetMinutes).toBe(10560);
  });

  it("supports positional argument signature", () => {
    const daily = buildDailyProgressDTO(createDaySummary("2026-09-08", { workMinutes: 480 }));
    const weekly = buildWeeklyProgressDTO({
      from: "2026-09-07",
      to: "2026-09-13",
      days: [],
    });
    const monthly = buildMonthlyProgressDTO({
      monthKey: "2026-09",
      summaries: [],
    });

    const dto = buildDashboardDTO("2026-09-08", "Asia/Jakarta", daily, weekly, monthly);
    expect(dto.anchorDate).toBe("2026-09-08");
    expect(dto.timezone).toBe("Asia/Jakarta");
    expect(dto.daily).toBe(daily);
    expect(dto.weekly).toBe(weekly);
    expect(dto.monthly).toBe(monthly);
  });
});

/* ========================================================================== */
/* 8. Utility functions formatting and week numbers                           */
/* ========================================================================== */
describe("formatting helpers", () => {
  it("formats date ranges and month labels cleanly", () => {
    expect(formatSliceDateRange("2026-09-01", "2026-09-06")).toBe("Sep 1 – Sep 6");
    expect(formatSliceDateRange("2026-03-01", "2026-03-01")).toBe("Mar 1");
    expect(formatMonthLabel("2026-09")).toBe("September 2026");
    expect(formatMonthLabel("2026-09-15")).toBe("September 2026");
  });

  it("computes ISO week numbers accurately", () => {
    expect(getISOWeekNumber("2026-01-01")).toBe(1);
    expect(getISOWeekNumber("2026-09-08")).toBe(37);
  });
});

/* ========================================================================== */
/* 9. Expected-so-far targets, human diffs, weekend flags                     */
/* ========================================================================== */
describe("countWorkdays", () => {
  it("counts Mon–Fri inclusively across a weekend", () => {
    // Thu 2026-09-10 .. Tue 2026-09-15 → Thu, Fri, Mon, Tue
    expect(countWorkdays("2026-09-10", "2026-09-15")).toBe(4);
    expect(countWorkdays("2026-09-12", "2026-09-13")).toBe(0);
  });

  it("counts across a month boundary and returns 0 for an empty range", () => {
    // Wed 2026-09-30 .. Mon 2026-10-05 → Wed, Thu, Fri, Mon
    expect(countWorkdays("2026-09-30", "2026-10-05")).toBe(4);
    expect(countWorkdays("2026-09-10", "2026-09-09")).toBe(0);
  });
});

describe("expectedMinutesSoFar (completed workdays before today)", () => {
  const week = { from: "2026-09-07", to: "2026-09-13" };

  it("mid-week Wednesday expects Mon + Tue only (today excluded)", () => {
    expect(expectedMinutesSoFar({ ...week, todayKey: "2026-09-09" })).toBe(2 * 480);
  });

  it("weekend anchor expects the full five workdays", () => {
    expect(expectedMinutesSoFar({ ...week, todayKey: "2026-09-12" })).toBe(5 * 480);
  });

  it("future week and a week starting today expect 0", () => {
    expect(expectedMinutesSoFar({ ...week, todayKey: "2026-09-01" })).toBe(0);
    expect(expectedMinutesSoFar({ ...week, todayKey: "2026-09-07" })).toBe(0);
  });

  it("past week expects the full target", () => {
    expect(expectedMinutesSoFar({ ...week, todayKey: "2026-10-03" })).toBe(5 * 480);
  });

  it("partially elapsed month counts workdays before today", () => {
    // Sep 2026 starts Tue; before Wed 16th: Sep 1–4 (4), 7–11 (5), 14–15 (2)
    expect(
      expectedMinutesSoFar({ from: "2026-09-01", to: "2026-09-30", todayKey: "2026-09-16" }),
    ).toBe(11 * 480);
  });
});

describe("formatDiffHuman", () => {
  it("uses an ASCII '+' / '-' sign with human units", () => {
    expect(formatDiffHuman(80)).toEqual({
      formatted: "+1h 20m",
      isAhead: true,
      isBehind: false,
      isExact: false,
    });
    expect(formatDiffHuman(-40)).toEqual({
      formatted: "-40m",
      isAhead: false,
      isBehind: true,
      isExact: false,
    });
    expect(formatDiffHuman(-130).formatted).toBe("-2h 10m");
    expect(formatDiffHuman(-120).formatted).toBe("-2h");
    // Pin ASCII hyphen-minus (U+002D), not U+2212
    expect(formatDiffHuman(-1).formatted.charCodeAt(0)).toBe(0x2d);
  });

  it("returns exact 0m for zero and -0", () => {
    const exact = { formatted: "0m", isAhead: false, isBehind: false, isExact: true };
    expect(formatDiffHuman(0)).toEqual(exact);
    expect(formatDiffHuman(-0)).toEqual(exact);
  });
});

describe("builders expose expected-so-far fields", () => {
  it("weekly: today in progress is excluded from expected but its work still counts", () => {
    // Today = Wed 2026-09-09; Mon 8h, Tue 6h, Wed 3h so far
    const weekly = buildWeeklyProgressDTO(
      {
        from: "2026-09-07",
        to: "2026-09-13",
        days: [
          { workDate: "2026-09-07", workMinutes: 480 },
          { workDate: "2026-09-08", workMinutes: 360 },
          { workDate: "2026-09-09", workMinutes: 180 },
        ],
      },
      "2026-09-09",
      "2026-09-09",
    );

    // Existing full-week fields unchanged
    expect(weekly.targetMinutes).toBe(2400);
    expect(weekly.diff.formatted).toBe("-23:00");

    expect(weekly.expectedMinutes).toBe(960);
    expect(weekly.expectedDiff.formatted).toBe("+1h");
    expect(weekly.expectedProgressPct).toBe(106);
    expect(weekly.isFuture).toBe(false);

    const [mon, tue, wed, thu, , sat] = weekly.days;
    expect(mon!.expectedMinutes).toBe(480);
    expect(mon!.expectedDiff.formatted).toBe("0m");
    expect(tue!.expectedDiff.formatted).toBe("-2h");
    expect(wed!.isToday).toBe(true);
    expect(wed!.expectedMinutes).toBe(0);
    expect(thu!.isFuture).toBe(true);
    expect(thu!.expectedMinutes).toBe(0);
    expect(sat!.expectedMinutes).toBe(0);
  });

  it("weekly: mid-week behind pace reads in human units, not H:MM", () => {
    const weekly = buildWeeklyProgressDTO(
      {
        from: "2026-09-07",
        to: "2026-09-13",
        days: [
          { workDate: "2026-09-07", workMinutes: 400 },
          { workDate: "2026-09-08", workMinutes: 430 },
        ],
      },
      "2026-09-09",
      "2026-09-09",
    );
    expect(weekly.expectedDiff.formatted).toBe("-2h 10m");
  });

  it("weekly: future week is flagged and expects nothing", () => {
    const weekly = buildWeeklyProgressDTO(
      { from: "2026-09-14", to: "2026-09-20" },
      "2026-09-14",
      "2026-09-09",
    );
    expect(weekly.isFuture).toBe(true);
    expect(weekly.expectedMinutes).toBe(0);
    expect(weekly.expectedDiff.isExact).toBe(true);
  });

  it("weekly: omitted todayKey treats the week as elapsed (expected = full target)", () => {
    const weekly = buildWeeklyProgressDTO({ from: "2026-09-07", to: "2026-09-13" }, "2026-09-07");
    expect(weekly.expectedMinutes).toBe(weekly.targetMinutes);
    expect(weekly.days.every((d) => !d.isFuture)).toBe(true);
  });

  it("monthly: partially elapsed month compares to workdays before today", () => {
    const monthly = buildMonthlyProgressDTO(
      { monthKey: "2026-09", summaries: [{ workDate: "2026-09-01", workMinutes: 480 }] },
      "2026-09",
      "2026-09-16",
    );
    expect(monthly.totalTargetMinutes).toBe(22 * 480);
    expect(monthly.formattedTotalTarget).toBe("176:00");
    expect(monthly.expectedMinutes).toBe(11 * 480);
    expect(monthly.expectedDiff.formatted).toBe("-80h");
  });

  it("daily: weekend flag, and today's expected is 0 while past workdays expect 8h", () => {
    const sat = buildDailyProgressDTO(null, "2026-09-12", "Asia/Jakarta", "2026-09-12");
    expect(sat.isWeekend).toBe(true);
    expect(sat.expectedMinutes).toBe(0);

    const today = buildDailyProgressDTO(null, "2026-09-09", "Asia/Jakarta", "2026-09-09");
    expect(today.isWeekend).toBe(false);
    expect(today.expectedMinutes).toBe(0);
    expect(today.diff.formatted).toBe("-8:00");

    const past = buildDailyProgressDTO(null, "2026-09-08", "Asia/Jakarta", "2026-09-09");
    expect(past.expectedMinutes).toBe(480);
    expect(past.expectedDiff.formatted).toBe("-8h");

    const future = buildDailyProgressDTO(null, "2026-09-10", "Asia/Jakarta", "2026-09-09");
    expect(future.isFuture).toBe(true);
  });
});
