/**
 * Pure date-row lookup: find the worksheet row for a "YYYY-MM-DD" day key.
 * No db, no google — the caller supplies the rows read from the sheet.
 */
import type { SheetMapping } from "./mapping";

type DateColumnMapping = Pick<SheetMapping, "dateColumn" | "headerRow">;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** "9/3/2026", "04-09-2026", "3.9.26" — separator-agnostic numeric dates. */
const NUMERIC_DATE = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/;

/**
 * A1 column letter → 0-based index ("A"→0, "Z"→25, "AA"→26).
 */
export function columnToIndex(letter: string): number {
  let index = 0;
  for (const ch of letter) {
    index = index * 26 + (ch.charCodeAt(0) - "A".charCodeAt(0) + 1);
  }
  return index - 1;
}

/**
 * Find the 1-based spreadsheet row whose date cell matches `targetDate`.
 *
 * Matching normalizes common sheet formats: exact ISO "YYYY-MM-DD", numeric
 * "M/D/YYYY" and "D/M/YYYY" (both interpretations are tried, so day-first and
 * month-first sheets both match), plus a Date.parse fallback for textual
 * dates like "Sep 3, 2026" (local calendar parts are used because text dates
 * parse to local midnight; ISO strings never reach the fallback).
 *
 * Scanning starts AFTER `mapping.headerRow` (1-based header row); when absent,
 * row 1 is treated as data. Returns null when no row matches.
 */
export function findDateRow(
  rows: string[][],
  mapping: DateColumnMapping,
  targetDate: string,
): number | null {
  const colIndex = columnToIndex(mapping.dateColumn);
  const startRow = mapping.headerRow ?? 0;
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const cell = row?.[colIndex];
    if (cell === undefined || cell === null || String(cell).trim() === "") {
      continue;
    }
    if (candidateDayKeys(String(cell)).includes(targetDate)) {
      return i + 1;
    }
  }
  return null;
}

/**
 * Every plausible "YYYY-MM-DD" interpretation of a sheet cell.
 */
function candidateDayKeys(cell: string): string[] {
  const trimmed = cell.trim();
  if (ISO_DATE.test(trimmed)) return [trimmed];

  const numeric = NUMERIC_DATE.exec(trimmed);
  if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    const y = twoDigitYear(Number(numeric[3]));
    // Try month-first AND day-first — compare against the target date.
    return [
      dayKeyFromParts(y, a, b),
      dayKeyFromParts(y, b, a),
    ].filter((key): key is string => key !== null);
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return [
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    ];
  }
  return [];
}

function twoDigitYear(year: number): number {
  return year < 100 ? 2000 + year : year;
}

/** Builds a zero-padded key, rejecting impossible calendar dates (Feb 30). */
function dayKeyFromParts(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
