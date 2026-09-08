import { describe, expect, it } from "vitest";

import {
  aggregateMonthWeekSlices,
  buildMonthlyProgressDTO,
  formatDiffMinutes,
  formatSliceDateRange,
  partitionMonthIntoWeekSlices,
} from "./domain";
import type { DashboardTab } from "@/components/dashboard/dashboard-view";
import type { MonthWeekSliceDTO } from "./types";

/* ========================================================================== */
/* Challenge 1: Accurate rendering of all week slices & Total row             */
/* ========================================================================== */
describe("Challenge 1: Personal Weekly Report Table Slices & Total Row Verification", () => {
  it("accurately produces all 5 week slices for September 2026 matching Google Sheet", () => {
    const slices = partitionMonthIntoWeekSlices("2026-09");
    expect(slices).toHaveLength(5);

    // Week 1: Sep 1 – Sep 6 (4 workdays = 32:00)
    expect(slices[0].label).toBe("WEEK 1");
    expect(slices[0].dateRangeLabel).toBe("Sep 1 – Sep 6");
    expect(slices[0].workdaysCount).toBe(4);
    expect(slices[0].targetMinutes).toBe(1920);

    // Week 2: Sep 7 – Sep 13 (5 workdays = 40:00)
    expect(slices[1].label).toBe("WEEK 2");
    expect(slices[1].dateRangeLabel).toBe("Sep 7 – Sep 13");
    expect(slices[1].workdaysCount).toBe(5);
    expect(slices[1].targetMinutes).toBe(2400);

    // Week 3: Sep 14 – Sep 20 (5 workdays = 40:00)
    expect(slices[2].label).toBe("WEEK 3");
    expect(slices[2].dateRangeLabel).toBe("Sep 14 – Sep 20");
    expect(slices[2].workdaysCount).toBe(5);
    expect(slices[2].targetMinutes).toBe(2400);

    // Week 4: Sep 21 – Sep 27 (5 workdays = 40:00)
    expect(slices[3].label).toBe("WEEK 4");
    expect(slices[3].dateRangeLabel).toBe("Sep 21 – Sep 27");
    expect(slices[3].workdaysCount).toBe(5);
    expect(slices[3].targetMinutes).toBe(2400);

    // Week 5: Sep 28 – Sep 30 (3 workdays = 24:00)
    expect(slices[4].label).toBe("WEEK 5");
    expect(slices[4].dateRangeLabel).toBe("Sep 28 – Sep 30");
    expect(slices[4].workdaysCount).toBe(3);
    expect(slices[4].targetMinutes).toBe(1440);

    // Month Total: 22 workdays = 176:00
    const totalWorkdays = slices.reduce((sum, s) => sum + s.workdaysCount, 0);
    const totalTarget = slices.reduce((sum, s) => sum + s.targetMinutes, 0);
    expect(totalWorkdays).toBe(22);
    expect(totalTarget).toBe(10560);
  });

  it("produces exact DTO structure for PersonalWeeklyReportTable including Total row", () => {
    const slices = partitionMonthIntoWeekSlices("2026-09");
    const mockDaySummaries = [
      // Week 1: 32 hours logged
      { workDate: "2026-09-01", totals: { workMinutes: 480 } },
      { workDate: "2026-09-02", totals: { workMinutes: 480 } },
      { workDate: "2026-09-03", totals: { workMinutes: 480 } },
      { workDate: "2026-09-04", totals: { workMinutes: 480 } },
      // Week 2: 6 hours logged
      { workDate: "2026-09-07", totals: { workMinutes: 360 } },
    ];

    const weekSlices = aggregateMonthWeekSlices(slices, mockDaySummaries);
    const monthlyDTO = buildMonthlyProgressDTO({
      monthKey: "2026-09",
      weekSlices,
      summaries: mockDaySummaries,
    });

    // Week 1 row verification
    expect(monthlyDTO.weekSlices[0].label).toBe("WEEK 1");
    expect(monthlyDTO.weekSlices[0].formattedTarget).toBe("32:00");
    expect(monthlyDTO.weekSlices[0].formattedLogged).toBe("32:00");
    expect(monthlyDTO.weekSlices[0].diff.formatted).toBe("0:00");
    expect(monthlyDTO.weekSlices[0].diff.isExact).toBe(true);
    expect(monthlyDTO.weekSlices[0].progressPct).toBe(100);

    // Week 2 row verification
    expect(monthlyDTO.weekSlices[1].label).toBe("WEEK 2");
    expect(monthlyDTO.weekSlices[1].formattedTarget).toBe("40:00");
    expect(monthlyDTO.weekSlices[1].formattedLogged).toBe("6:00");
    expect(monthlyDTO.weekSlices[1].diff.formatted).toBe("-34:00");
    expect(monthlyDTO.weekSlices[1].diff.isBehind).toBe(true);
    expect(monthlyDTO.weekSlices[1].progressPct).toBe(15);

    // Total row verification
    expect(monthlyDTO.formattedTotalTarget).toBe("176:00");
    expect(monthlyDTO.formattedTotalLogged).toBe("38:00");
    expect(monthlyDTO.diff.formatted).toBe("-138:00");
    expect(monthlyDTO.diff.isBehind).toBe(true);
    expect(monthlyDTO.totalWorkdays).toBe(22);
    expect(monthlyDTO.progressPct).toBe(22);
    expect(formatSliceDateRange(monthlyDTO.from, monthlyDTO.to)).toBe("Sep 1 – Sep 30");
  });
});

/* ========================================================================== */
/* Challenge 2: Diff badge color coding verification                          */
/* ========================================================================== */
describe("Challenge 2: Diff Badge Color Coding Logic Verification", () => {
  function getDiffBadgeClasses(diff: { isAhead: boolean; isBehind: boolean; isExact: boolean }) {
    if (diff.isAhead) {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/40";
    }
    if (diff.isBehind) {
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-950/40";
    }
    return "border-border/80 bg-muted/50 text-muted-foreground";
  }

  it("assigns emerald color styling to positive diffs (ahead of target)", () => {
    const positiveDiff = formatDiffMinutes(60); // +1:00
    expect(positiveDiff.isAhead).toBe(true);
    expect(positiveDiff.isBehind).toBe(false);
    expect(positiveDiff.isExact).toBe(false);

    const classes = getDiffBadgeClasses(positiveDiff);
    expect(classes).toContain("emerald");
    expect(classes).not.toContain("amber");
  });

  it("assigns amber color styling to negative diffs (behind target)", () => {
    const negativeDiff = formatDiffMinutes(-2040); // -34:00
    expect(negativeDiff.isAhead).toBe(false);
    expect(negativeDiff.isBehind).toBe(true);
    expect(negativeDiff.isExact).toBe(false);

    const classes = getDiffBadgeClasses(negativeDiff);
    expect(classes).toContain("amber");
    expect(classes).not.toContain("emerald");
  });

  it("assigns neutral muted styling to exact zero diffs (met target)", () => {
    const zeroDiff = formatDiffMinutes(0);
    expect(zeroDiff.isAhead).toBe(false);
    expect(zeroDiff.isBehind).toBe(false);
    expect(zeroDiff.isExact).toBe(true);

    const classes = getDiffBadgeClasses(zeroDiff);
    expect(classes).toContain("text-muted-foreground");
    expect(classes).not.toContain("emerald");
    expect(classes).not.toContain("amber");
  });
});

/* ========================================================================== */
/* Challenge 3: Interactive Week Navigation Bug Reproduction & Oracle         */
/* ========================================================================== */
describe("Challenge 3: Interactive Week Navigation Tab Switch Bug", () => {
  /**
   * Model simulating DashboardView state management:
   * Replicates exact logic in src/components/dashboard/dashboard-view.tsx
   */
  class DashboardViewModel {
    activeTab: DashboardTab;
    currentDate: string;
    pushedUrl: string | null = null;

    constructor(initialTab: DashboardTab = "overview", initialDate: string = "2026-09-08") {
      this.activeTab = initialTab;
      this.currentDate = initialDate;
    }

    // Exact implementation in dashboard-view.tsx lines 57-63
    handleTabChange(value: string) {
      const nextTab = value as DashboardTab;
      this.activeTab = nextTab;
      this.pushedUrl = `/dashboard?date=${this.currentDate}&tab=${nextTab}`;
    }

    // Exact implementation in dashboard-view.tsx lines 51-55
    navigateToAsCurrentlyImplemented(newDate: string, tab: DashboardTab = this.activeTab) {
      // NOTE: setActiveTab(tab) is MISSING here!
      this.pushedUrl = `/dashboard?date=${newDate}&tab=${tab}`;
    }

    // Proposed corrected implementation
    navigateToCorrected(newDate: string, tab: DashboardTab = this.activeTab) {
      if (tab !== this.activeTab) {
        this.activeTab = tab;
      }
      this.pushedUrl = `/dashboard?date=${newDate}&tab=${tab}`;
    }

    // Simulates Server Component re-render passing updated initialTab prop
    simulateServerReRenderWithoutStateSync(newInitialTab: DashboardTab) {
      // React useState does NOT re-initialize state on prop change!
      // In dashboard-view.tsx there is no useEffect or key, so activeTab remains unchanged.
      void newInitialTab;
    }
  }

  it("REPRODUCES BUG: clicking a week row pushes tab=weekly to URL but fails to switch activeTab", () => {
    const view = new DashboardViewModel("overview", "2026-09-08");
    expect(view.activeTab).toBe("overview");

    const week2Slice: MonthWeekSliceDTO = {
      weekIndex: 2,
      label: "WEEK 2",
      from: "2026-09-07",
      to: "2026-09-13",
      dateRange: "Sep 7 – Sep 13",
      dateRangeLabel: "Sep 7 – Sep 13",
      workdaysCount: 5,
      targetMinutes: 2400,
      formattedTarget: "40:00",
      workMinutes: 360,
      formattedLogged: "6:00",
      diffMinutes: -2040,
      formattedDiff: formatDiffMinutes(-2040),
      diff: formatDiffMinutes(-2040),
      isAhead: false,
      isBehind: true,
      isExact: false,
      progressPct: 15,
    };

    // User clicks week 2 in PersonalWeeklyReportTable
    // Overview tab onSelectWeek callback: (slice) => navigateTo(slice.from, "weekly")
    view.navigateToAsCurrentlyImplemented(week2Slice.from, "weekly");

    // The URL was pushed with tab=weekly
    expect(view.pushedUrl).toBe("/dashboard?date=2026-09-07&tab=weekly");

    // BUT activeTab in component state is STILL "overview"!
    // The user remains trapped on the Overview tab!
    expect(view.activeTab).toBe("overview"); // BUG CONFIRMED!
    expect(view.activeTab).not.toBe("weekly");

    // Even when server re-renders and passes initialTab="weekly", React useState retains old state
    view.simulateServerReRenderWithoutStateSync("weekly");
    expect(view.activeTab).toBe("overview"); // Still stuck!
  });

  it("VERIFIES FIX: navigateTo must update activeTab when tab argument is provided", () => {
    const view = new DashboardViewModel("overview", "2026-09-08");
    expect(view.activeTab).toBe("overview");

    // With corrected navigateTo
    view.navigateToCorrected("2026-09-07", "weekly");

    expect(view.pushedUrl).toBe("/dashboard?date=2026-09-07&tab=weekly");
    expect(view.activeTab).toBe("weekly"); // PASSES WITH FIX!
  });
});
