import { describe, expect, it } from "vitest";
import {
  allocateTimelineEntries,
  parseClockMinutes,
  parseDurationMinutes,
  type RawCategoryItem,
} from "./pull";

describe("parseClockMinutes", () => {
  it("parses 24-hour and 12-hour clock strings", () => {
    expect(parseClockMinutes("8:20")).toBe(500);
    expect(parseClockMinutes("08:20")).toBe(500);
    expect(parseClockMinutes("08:20:00")).toBe(500);
    expect(parseClockMinutes("8:20 AM")).toBe(500);
    expect(parseClockMinutes("2:30 PM")).toBe(14 * 60 + 30);
    expect(parseClockMinutes("14:30")).toBe(14 * 60 + 30);
    expect(parseClockMinutes("12:00 AM")).toBe(0);
    expect(parseClockMinutes("12:00 PM")).toBe(12 * 60);
  });

  it("parses decimal day fractions from spreadsheet", () => {
    // 0.5 = 12:00 PM = 720 minutes
    expect(parseClockMinutes(0.5)).toBe(720);
    // 0.347222 = ~500 minutes (08:20)
    expect(parseClockMinutes(0.34722222)).toBe(500);
  });

  it("handles null, empty, or invalid values gracefully", () => {
    expect(parseClockMinutes(null)).toBeNull();
    expect(parseClockMinutes(undefined)).toBeNull();
    expect(parseClockMinutes("")).toBeNull();
    expect(parseClockMinutes("-")).toBeNull();
    expect(parseClockMinutes("invalid")).toBeNull();
  });
});

describe("parseDurationMinutes", () => {
  it("parses human duration formats (h and m)", () => {
    expect(parseDurationMinutes("1h 45m")).toBe(105);
    expect(parseDurationMinutes("4h 15m")).toBe(255);
    expect(parseDurationMinutes("1 hour 45 mins")).toBe(105);
    expect(parseDurationMinutes("45m")).toBe(45);
    expect(parseDurationMinutes("2h")).toBe(120);
  });

  it("parses clock-style duration formats (H:MM)", () => {
    expect(parseDurationMinutes("1:45")).toBe(105);
    expect(parseDurationMinutes("04:15")).toBe(255);
    expect(parseDurationMinutes("0:30")).toBe(30);
  });

  it("parses numeric decimal hours", () => {
    expect(parseDurationMinutes("1.75")).toBe(105);
    expect(parseDurationMinutes(1.75)).toBe(105);
    expect(parseDurationMinutes(2)).toBe(120);
  });

  it("handles empty or zero values", () => {
    expect(parseDurationMinutes("")).toBe(0);
    expect(parseDurationMinutes("-")).toBe(0);
    expect(parseDurationMinutes("0")).toBe(0);
    expect(parseDurationMinutes(null)).toBe(0);
  });
});

describe("allocateTimelineEntries", () => {
  const defaultCategoryNames = {
    website_management: "Website Management",
    cyber_security: "Cyber Security",
    technology_innovation: "Technology Innovation",
    infrastructure_management: "Infrastructure Management",
    research: "Research",
    meeting: "Meeting",
    training: "Training",
    other_tasks: "Other Tasks",
  };

  it("allocates single item without break", () => {
    const items: RawCategoryItem[] = [
      {
        categoryKey: "meeting",
        durationMinutes: 60,
        notes: "Team Sync",
      },
    ];

    const result = allocateTimelineEntries({
      categoryItems: items,
      clockInMinutes: 510, // 08:30
      breakStartMinutes: null,
      breakEndMinutes: null,
      defaultCategoryNames,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      categoryKey: "meeting",
      taskName: "Team Sync",
      notes: "Team Sync",
      startMinutes: 510,
      endMinutes: 570,
    });
  });

  it("splits multiline notes into balanced tasks", () => {
    const items: RawCategoryItem[] = [
      {
        categoryKey: "meeting",
        durationMinutes: 100,
        notes: "Standup Meeting\nClient Discussion",
      },
    ];

    const result = allocateTimelineEntries({
      categoryItems: items,
      clockInMinutes: 540, // 09:00
      breakStartMinutes: null,
      breakEndMinutes: null,
      defaultCategoryNames,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      categoryKey: "meeting",
      taskName: "Standup Meeting",
      notes: "Standup Meeting",
      startMinutes: 540,
      endMinutes: 590, // 50 min
    });
    expect(result[1]).toEqual({
      categoryKey: "meeting",
      taskName: "Client Discussion",
      notes: "Client Discussion",
      startMinutes: 590,
      endMinutes: 640, // 50 min
    });
  });

  it("splits an entry cleanly across the break window", () => {
    const items: RawCategoryItem[] = [
      {
        categoryKey: "training",
        durationMinutes: 120, // 2 hours
        notes: "Deep Learning Workshop",
      },
    ];

    // Clock in: 11:30 (690), Break: 12:00 to 13:00 (720 to 780)
    // 30 min before break (690..720) and 90 min after break (780..870)
    const result = allocateTimelineEntries({
      categoryItems: items,
      clockInMinutes: 690,
      breakStartMinutes: 720,
      breakEndMinutes: 780,
      defaultCategoryNames,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      categoryKey: "training",
      taskName: "Deep Learning Workshop",
      notes: "Deep Learning Workshop",
      startMinutes: 690,
      endMinutes: 720,
    });
    expect(result[1]).toEqual({
      categoryKey: "training",
      taskName: "Deep Learning Workshop",
      notes: "Deep Learning Workshop",
      startMinutes: 780,
      endMinutes: 870,
    });
  });

  it("uses category fallback name when notes is empty", () => {
    const items: RawCategoryItem[] = [
      {
        categoryKey: "research",
        durationMinutes: 45,
        notes: "",
      },
    ];

    const result = allocateTimelineEntries({
      categoryItems: items,
      clockInMinutes: 500,
      breakStartMinutes: null,
      breakEndMinutes: null,
      defaultCategoryNames,
    });

    expect(result).toHaveLength(1);
    expect(result[0].taskName).toBe("Research");
    expect(result[0].notes).toBe("Research");
    expect(result[0].endMinutes - result[0].startMinutes).toBe(45);
  });

  it("allocates tasks using explicit durations in parentheses when present", () => {
    const items: RawCategoryItem[] = [
      {
        categoryKey: "meeting",
        durationMinutes: 180, // 3h = 120m + 60m
        notes:
          "Infrastructure Management Training (2:00)\nTraining (1:00)",
      },
    ];

    const result = allocateTimelineEntries({
      categoryItems: items,
      clockInMinutes: 480, // 08:00
      breakStartMinutes: null,
      breakEndMinutes: null,
      defaultCategoryNames,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      categoryKey: "meeting",
      taskName: "Infrastructure Management Training",
      notes: "Infrastructure Management Training",
      startMinutes: 480,
      endMinutes: 600, // 120 min
    });
    expect(result[1]).toEqual({
      categoryKey: "meeting",
      taskName: "Training",
      notes: "Training",
      startMinutes: 600,
      endMinutes: 660, // 60 min
    });
  });
});
