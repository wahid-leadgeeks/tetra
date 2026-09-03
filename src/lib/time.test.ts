import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  formatHMM,
  formatHuman,
  minutesBetween,
  zonedClock,
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
});
