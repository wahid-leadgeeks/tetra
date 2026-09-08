import { describe, expect, it } from "vitest";

import { NAV_ITEMS } from "@/components/app-nav/app-nav";
import { SCREEN_SHORTCUTS } from "@/components/keyboard/keyboard-nav";
import {
  aggregateMonthWeekSlices,
  formatSliceDateRange,
  partitionMonthIntoWeekSlices,
} from "@/features/dashboard/domain";

describe("Milestone 2: Navigation & Shortcut Contracts", () => {
  it("defines exactly 6 navigation items in NAV_ITEMS with Dashboard at index 1", () => {
    expect(NAV_ITEMS).toHaveLength(6);

    expect(NAV_ITEMS[0]).toMatchObject({
      href: "/",
      label: "Today",
      shortcut: "1",
      testId: "nav-today",
    });

    expect(NAV_ITEMS[1]).toMatchObject({
      href: "/dashboard",
      label: "Dashboard",
      shortcut: "2",
      testId: "nav-dashboard",
    });

    expect(NAV_ITEMS[2]).toMatchObject({
      href: "/timeline",
      label: "Timeline",
      shortcut: "3",
      testId: "nav-timeline",
    });

    expect(NAV_ITEMS[3]).toMatchObject({
      href: "/tasks",
      label: "Tasks",
      shortcut: "4",
      testId: "nav-tasks",
    });

    expect(NAV_ITEMS[4]).toMatchObject({
      href: "/reports",
      label: "Reports",
      shortcut: "5",
      testId: "nav-reports",
    });

    expect(NAV_ITEMS[5]).toMatchObject({
      href: "/settings",
      label: "Settings",
      shortcut: "6",
      testId: "nav-settings",
    });
  });

  it("maps keyboard shortcuts 1 through 6 correctly, mapping key 2 to /dashboard", () => {
    expect(SCREEN_SHORTCUTS["1"]).toBe("/");
    expect(SCREEN_SHORTCUTS["2"]).toBe("/dashboard");
    expect(SCREEN_SHORTCUTS["3"]).toBe("/timeline");
    expect(SCREEN_SHORTCUTS["4"]).toBe("/tasks");
    expect(SCREEN_SHORTCUTS["5"]).toBe("/reports");
    expect(SCREEN_SHORTCUTS["6"]).toBe("/settings");
    expect(Object.keys(SCREEN_SHORTCUTS)).toHaveLength(6);
  });
});

describe("Milestone 2: Dashboard Route Parameter Contracts", () => {
  const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const VALID_TABS = ["overview", "daily", "weekly", "monthly"] as const;
  type DashboardTab = (typeof VALID_TABS)[number];

  function resolveDate(dateParam: string | undefined, fallback: string): string {
    return dateParam && DAY_KEY_PATTERN.test(dateParam) ? dateParam : fallback;
  }

  function resolveTab(tabParam: string | undefined): DashboardTab {
    return tabParam && (VALID_TABS as readonly string[]).includes(tabParam)
      ? (tabParam as DashboardTab)
      : "overview";
  }

  it("validates date parameter and falls back to today", () => {
    const fallback = "2026-09-08";
    expect(resolveDate("2026-09-15", fallback)).toBe("2026-09-15");
    expect(resolveDate("invalid-date", fallback)).toBe("2026-09-08");
    expect(resolveDate(undefined, fallback)).toBe("2026-09-08");
    expect(resolveDate("", fallback)).toBe("2026-09-08");
    expect(resolveDate("2026/09/15", fallback)).toBe("2026-09-08");
  });

  it("validates tab parameter and falls back to overview", () => {
    expect(resolveTab("overview")).toBe("overview");
    expect(resolveTab("daily")).toBe("daily");
    expect(resolveTab("weekly")).toBe("weekly");
    expect(resolveTab("monthly")).toBe("monthly");
    expect(resolveTab("invalid")).toBe("overview");
    expect(resolveTab(undefined)).toBe("overview");
    expect(resolveTab("")).toBe("overview");
  });
});

describe("Milestone 2: Personal Weekly Report Table Sheet Alignment", () => {
  it("reproduces September 2026 sheet rows 44–55 target breakdown", () => {
    const slices = partitionMonthIntoWeekSlices("2026-09");
    expect(slices).toHaveLength(5);

    // Week 1: Sep 1 – Sep 6, 4 workdays = 32:00 (1920 min)
    expect(slices[0].label).toBe("WEEK 1");
    expect(slices[0].dateRangeLabel).toBe("Sep 1 – Sep 6");
    expect(slices[0].workdaysCount).toBe(4);
    expect(slices[0].targetMinutes).toBe(1920);

    // Week 2: Sep 7 – Sep 13, 5 workdays = 40:00 (2400 min)
    expect(slices[1].label).toBe("WEEK 2");
    expect(slices[1].dateRangeLabel).toBe("Sep 7 – Sep 13");
    expect(slices[1].workdaysCount).toBe(5);
    expect(slices[1].targetMinutes).toBe(2400);

    // Week 3: Sep 14 – Sep 20, 5 workdays = 40:00 (2400 min)
    expect(slices[2].label).toBe("WEEK 3");
    expect(slices[2].dateRangeLabel).toBe("Sep 14 – Sep 20");
    expect(slices[2].workdaysCount).toBe(5);
    expect(slices[2].targetMinutes).toBe(2400);

    // Week 4: Sep 21 – Sep 27, 5 workdays = 40:00 (2400 min)
    expect(slices[3].label).toBe("WEEK 4");
    expect(slices[3].dateRangeLabel).toBe("Sep 21 – Sep 27");
    expect(slices[3].workdaysCount).toBe(5);
    expect(slices[3].targetMinutes).toBe(2400);

    // Week 5: Sep 28 – Sep 30, 3 workdays = 24:00 (1440 min)
    expect(slices[4].label).toBe("WEEK 5");
    expect(slices[4].dateRangeLabel).toBe("Sep 28 – Sep 30");
    expect(slices[4].workdaysCount).toBe(3);
    expect(slices[4].targetMinutes).toBe(1440);

    // Month Total: 22 workdays = 176:00 (10560 min)
    const totalTargetMinutes = slices.reduce((sum, s) => sum + s.targetMinutes, 0);
    const totalWorkdays = slices.reduce((sum, s) => sum + s.workdaysCount, 0);
    expect(totalWorkdays).toBe(22);
    expect(totalTargetMinutes).toBe(10560);
  });

  it("calculates accurate diffs and progress percentages for month week slices", () => {
    const slices = partitionMonthIntoWeekSlices("2026-09");
    const dayMinutesMap = new Map<string, number>();

    // Week 1 completed (32h = 1920 min)
    dayMinutesMap.set("2026-09-01", 480);
    dayMinutesMap.set("2026-09-02", 480);
    dayMinutesMap.set("2026-09-03", 480);
    dayMinutesMap.set("2026-09-04", 480);

    // Week 2 partial (6h = 360 min)
    dayMinutesMap.set("2026-09-07", 360);

    const aggregated = aggregateMonthWeekSlices(slices, dayMinutesMap);
    expect(aggregated).toHaveLength(5);

    // Week 1: 32:00 logged, target 32:00, diff 0:00, 100%
    expect(aggregated[0].formattedLogged).toBe("32:00");
    expect(aggregated[0].formattedTarget).toBe("32:00");
    expect(aggregated[0].diff.formatted).toBe("0:00");
    expect(aggregated[0].diff.isExact).toBe(true);
    expect(aggregated[0].progressPct).toBe(100);

    // Week 2: 6:00 logged, target 40:00, diff -34:00, 15%
    expect(aggregated[1].formattedLogged).toBe("6:00");
    expect(aggregated[1].formattedTarget).toBe("40:00");
    expect(aggregated[1].diff.formatted).toBe("-34:00");
    expect(aggregated[1].diff.isBehind).toBe(true);
    expect(aggregated[1].progressPct).toBe(15);

    // Total range label format
    expect(formatSliceDateRange("2026-09-01", "2026-09-30")).toBe("Sep 1 – Sep 30");
  });
});
