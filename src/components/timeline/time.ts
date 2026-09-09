"use client";

/**
 * Shared client-side time helpers built on the pure @/lib/time kernel.
 * UI-specific glue only — never re-implement duration math here.
 */
import { addDaysISO, todayKey, zonedClock, zonedClockHMM, zonedDayStart } from "@/lib/time";

/** "HH:MM" (zoned) → UTC ISO instant on the given day key. */
export function timeToISO(dayKey: string, time: string, timeZone: string): string {
  const [h, m] = time.split(":").map((part) => Number.parseInt(part, 10));
  const minutes = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  return new Date(zonedDayStart(dayKey, timeZone).getTime() + minutes * 60_000).toISOString();
}

/** UTC ISO instant → "HH:MM" in the user's timezone (input[type=time] value). */
export function isoToTime(iso: string, timeZone: string): string {
  return zonedClock(new Date(iso), timeZone);
}

/** "2026-09-02" → "Wednesday, September 2, 2026" (locale, tz-safe at noon UTC). */
export function formatDayLong(dayKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dayKey}T12:00:00Z`));
}

/** "2026-09-02" → "Sep 2, 2026". */
export function formatDayShort(dayKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dayKey}T12:00:00Z`));
}

/** ISO instant → "8:20" / "14:32" in the user's timezone (matches spreadsheet unpadded hour). */
export function formatClock(iso: string, timeZone: string): string {
  return zonedClockHMM(new Date(iso), timeZone);
}

/** ISO instant → "Sep 2, 14:32" in the user's timezone. */
export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function previousDay(dayKey: string): string {
  return addDaysISO(dayKey, -1);
}

export function nextDay(dayKey: string): string {
  return addDaysISO(dayKey, 1);
}

export function isToday(dayKey: string, timeZone: string): boolean {
  return dayKey === todayKey(timeZone);
}

export {
  getDayOfWeek,
  isWeekend,
  previousWorkday,
  nextWorkday,
  ensureWorkday,
} from "@/lib/time";

