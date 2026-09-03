/**
 * Pure time helpers. UTC storage, user-timezone day grouping (ADR-0007).
 * All functions are pure and unit-testable. Never trust client durations.
 */

/** Whole minutes between two instants, never negative. */
export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60_000));
}

/** "7:22" — H:MM rendering per ARCHITECTURE.md. */
export function formatHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** "3h 15m" / "45m" — human totals for the Today screen. */
export function formatHuman(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Local clock time "08:45" in the given IANA timezone. */
export function zonedClock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Local calendar key "2026-09-02" in the given IANA timezone. */
export function zonedDayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUTC - date.getTime();
}

/** UTC instant of local midnight for a "YYYY-MM-DD" day key. */
export function zonedDayStart(dayKey: string, timeZone: string): Date {
  const guess = Date.parse(`${dayKey}T00:00:00Z`);
  let utc = guess - tzOffsetMs(new Date(guess), timeZone);
  if (zonedDayKey(new Date(utc), timeZone) !== dayKey) {
    utc = guess - tzOffsetMs(new Date(utc), timeZone);
  }
  return new Date(utc);
}

/** UTC instant one millisecond before the next local midnight. */
export function zonedDayEnd(dayKey: string, timeZone: string): Date {
  const next = zonedDayStart(addDaysISO(dayKey, 1), timeZone);
  return new Date(next.getTime() - 1);
}

export function addDaysISO(dayKey: string, days: number): string {
  const d = new Date(Date.parse(`${dayKey}T00:00:00Z`));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayKey(timeZone: string): string {
  return zonedDayKey(new Date(), timeZone);
}
