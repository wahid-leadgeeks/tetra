import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  ensureWorkday,
  formatHMM,
  formatHuman,
  getDayOfWeek,
  isWeekend,
  minutesBetween,
  nextWorkday,
  previousWorkday,
  zonedClock,
  zonedClockHMM,
  zonedDayEnd,
  zonedDayKey,
  zonedDayStart,
} from "./time";

describe("time helpers", () => {
  it("formats H:MM", () => {
    expect(formatHMM(0)).toBe("0:00");
    expect(formatHMM(65)).toBe("1:05");
    expect(formatHMM(442)).toBe("7:22");
  });

  it("formats human durations", () => {
    expect(formatHuman(45)).toBe("45m");
    expect(formatHuman(60)).toBe("1h");
    expect(formatHuman(195)).toBe("3h 15m");
  });

  it("computes whole minutes, never negative", () => {
    const a = new Date("2026-09-02T08:45:00Z");
    const b = new Date("2026-09-02T09:30:00Z");
    expect(minutesBetween(a, b)).toBe(45);
    expect(minutesBetween(b, a)).toBe(0);
  });

  it("groups days by timezone (ADR-0007)", () => {
    // 2026-09-02 20:00 UTC is already Sep 3 in Asia/Jakarta (UTC+7).
    const utc = new Date("2026-09-02T20:00:00Z");
    expect(zonedDayKey(utc, "Asia/Jakarta")).toBe("2026-09-03");
    expect(zonedDayKey(utc, "UTC")).toBe("2026-09-02");
  });

  it("renders local clock times", () => {
    const utc = new Date("2026-09-02T01:45:00Z");
    expect(zonedClock(utc, "Asia/Jakarta")).toBe("08:45");
  });

  it("renders local clock times without leading zero for single-digit hours", () => {
    const utcMorning = new Date("2026-09-02T01:45:00Z");
    expect(zonedClockHMM(utcMorning, "Asia/Jakarta")).toBe("8:45");
    const utcEvening = new Date("2026-09-02T11:00:00Z");
    expect(zonedClockHMM(utcEvening, "Asia/Jakarta")).toBe("18:00");
    const utcMidnight = new Date("2026-09-02T17:00:00Z");
    expect(zonedClockHMM(utcMidnight, "Asia/Jakarta")).toBe("0:00");
  });

  it("converts day keys to UTC day boundaries", () => {
    const start = zonedDayStart("2026-09-02", "Asia/Jakarta");
    expect(start.toISOString()).toBe("2026-09-01T17:00:00.000Z");
    const end = zonedDayEnd("2026-09-02", "Asia/Jakarta");
    expect(end.toISOString()).toBe("2026-09-02T16:59:59.999Z");
    expect(zonedDayKey(start, "Asia/Jakarta")).toBe("2026-09-02");
    expect(zonedDayKey(end, "Asia/Jakarta")).toBe("2026-09-02");
  });

  it("adds days to ISO keys", () => {
    expect(addDaysISO("2026-09-02", 1)).toBe("2026-09-03");
    expect(addDaysISO("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("identifies day of week and weekends correctly", () => {
    expect(getDayOfWeek("2026-09-04")).toBe(5); // Friday
    expect(isWeekend("2026-09-04")).toBe(false);

    expect(getDayOfWeek("2026-09-05")).toBe(6); // Saturday
    expect(isWeekend("2026-09-05")).toBe(true);

    expect(getDayOfWeek("2026-09-06")).toBe(0); // Sunday
    expect(isWeekend("2026-09-06")).toBe(true);

    expect(getDayOfWeek("2026-09-07")).toBe(1); // Monday
    expect(isWeekend("2026-09-07")).toBe(false);
  });

  it("navigates previous workday skipping Saturday and Sunday", () => {
    // From Monday (Sep 7), previous workday is Friday (Sep 4)
    expect(previousWorkday("2026-09-07")).toBe("2026-09-04");
    // From Friday (Sep 4), previous workday is Thursday (Sep 3)
    expect(previousWorkday("2026-09-04")).toBe("2026-09-03");
  });

  it("navigates next workday skipping Saturday and Sunday", () => {
    // From Friday (Sep 4), next workday is Monday (Sep 7)
    expect(nextWorkday("2026-09-04")).toBe("2026-09-07");
    // From Thursday (Sep 3), next workday is Friday (Sep 4)
    expect(nextWorkday("2026-09-03")).toBe("2026-09-04");
  });

  it("snaps weekend days to preceding Friday with ensureWorkday", () => {
    // Weekdays pass through untouched
    expect(ensureWorkday("2026-09-04")).toBe("2026-09-04"); // Friday
    expect(ensureWorkday("2026-09-07")).toBe("2026-09-07"); // Monday

    // Saturday snaps back to Friday
    expect(ensureWorkday("2026-09-05")).toBe("2026-09-04");
    // Sunday snaps back to Friday
    expect(ensureWorkday("2026-09-06")).toBe("2026-09-04");
  });
});

