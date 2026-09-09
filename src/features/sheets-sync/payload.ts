/**
 * Pure sync payload generation (ARCHITECTURE.md sync flow: "Generate payload").
 * No db, no google — unit-testable with fixture DaySummaryDTO objects.
 */
import { createHash } from "node:crypto";
import { formatHMM, zonedClockHMM } from "@/lib/time";
import type {
  BreakDTO,
  CategoryTotalDTO,
  DaySummaryDTO,
  SyncCellDTO,
  TimeEntryDTO,
} from "@/lib/types";
import { CATEGORY_KEYS, type CategoryKey, type SheetMapping } from "./mapping";

/** How the date cell value renders: "2026-09-03" (iso) vs "9/3/2026" (display). */
export type DateValueFormat = "iso" | "display";

export interface BuildSyncPayloadOptions {
  dateValueFormat: DateValueFormat;
  /** 1-based spreadsheet row of the target date (from findDateRow). */
  rowNumber: number;
  /** IANA timezone the summary was computed in — clock values render in it. */
  timezone: string;
  /**
   * Write compiled category notes into the mapped notes columns.
   * Defaults to true; the preview toggle can turn it off per sync.
   */
  includeNotes?: boolean;
  /** Preview-dialog edits replacing the compiled notes per category. */
  notesOverrides?: Partial<Record<CategoryKey, string>>;
}

export interface SyncPayload {
  rowDateValue: string;
  cells: SyncCellDTO[];
}

/** Preview labels mirroring the seeded category names (scripts/seed.ts). */
const CATEGORY_LABELS: Record<CategoryKey, string> = {
  website_management: "Website Management",
  cyber_security: "Cyber Security",
  technology_innovation: "Technology Optimization & Innovation",
  infrastructure_management: "Infrastructure Management",
  research: "Research",
  meeting: "Meeting",
  training: "Training",
  other_tasks: "Other Tasks",
};

/**
 * Value decisions (documented per spec):
 * - Clock in/out: "H:mm" (unpadded single-digit hours, e.g. "8:00") in the
 *   summary timezone matching spreadsheet format; "" when attendance is
 *   missing or clock-out is not set — an empty string clears a stale sheet
 *   value on resync. The 'reviewed' gate normally guarantees both exist.
 * - Break start / end: Computed via computeSheetBreakTimes. If there are multiple
 *   breaks or any break before 12:00, all breaks are united starting from "12:00"
 *   to "12:00" + totalBreakMinutes, matching the company spreadsheet formula
 *   `=(E - B) - (D - C)` without over-deducting the span between separate breaks.
 *   "" when there are no breaks (clears stale values).
 * - Totals and every category cell: H:MM via formatHMM; unmapped categories
 *   write "0:00".
 * - Category notes cells (mapping.categoryNotes): one cell per category with
 *   compiled notes — see compileCategoryNotes. A category with no compiled
 *   notes gets NO cell, so an empty sync can never blank a manual note.
 */
export function buildSyncPayload(
  summary: DaySummaryDTO,
  mapping: SheetMapping,
  options: BuildSyncPayloadOptions,
): SyncPayload {
  const { dateValueFormat, rowNumber, timezone } = options;
  const attendance = summary.attendance;
  const breaks = attendance?.breaks ?? [];
  const totalBreakMinutes =
    summary.totals.breakMinutes ?? attendance?.breakMinutes ?? 0;
  const { breakStart, breakEnd } = computeSheetBreakTimes(
    breaks,
    totalBreakMinutes,
    timezone,
  );

  const cells: SyncCellDTO[] = [
    {
      a1: `${mapping.clockInColumn}${rowNumber}`,
      value: clockValue(attendance?.clockInAt, timezone),
      columnLabel: "Clock In",
    },
    {
      a1: `${mapping.breakStartColumn}${rowNumber}`,
      value: breakStart,
      columnLabel: "Break Start",
    },
    {
      a1: `${mapping.breakEndColumn}${rowNumber}`,
      value: breakEnd,
      columnLabel: "Break End",
    },
    {
      a1: `${mapping.clockOutColumn}${rowNumber}`,
      value: clockValue(attendance?.clockOutAt, timezone),
      columnLabel: "Clock Out",
    },
    {
      a1: `${mapping.dailyTotalColumn}${rowNumber}`,
      value: formatHMM(summary.totals.attendanceMinutes),
      columnLabel: "Daily Total (Attendance)",
    },
    {
      a1: `${mapping.workTotalColumn}${rowNumber}`,
      value: formatHMM(summary.totals.workMinutes),
      columnLabel: "Work Total",
    },
    ...CATEGORY_KEYS.map((key) => ({
      a1: `${mapping.categories[key]}${rowNumber}`,
      value: formatHMM(categoryMinutes(summary.byCategory, key)),
      columnLabel: CATEGORY_LABELS[key],
    })),
    ...notesCells(summary, mapping, options),
  ];

  return {
    rowDateValue:
      dateValueFormat === "iso"
        ? summary.workDate
        : displayDateValue(summary.workDate),
    cells,
  };
}

/**
 * Compiled per-category notes for the notes columns (I, K, M, O, Q, S, U, W):
 * the day's completed entries formatted as `<task/notes> (<duration>)` (e.g. "Task (1:45)"),
 * with durations accumulated for identical task descriptions, joined by newlines to
 * match the company spreadsheet format.
 */
export function compileCategoryNotes(
  entries: readonly TimeEntryDTO[],
): Map<CategoryKey, string> {
  const categoryItems = new Map<CategoryKey, Map<string, number>>();
  for (const entry of entries) {
    if (entry.status !== "completed") continue;
    const key = CATEGORY_KEYS.find((k) => k === entry.categoryKey);
    if (key === undefined) continue;
    const rawText = entry.notes?.trim() || entry.taskName.trim();
    if (!rawText) continue;

    // Strip trailing duration in parentheses if already present to avoid duplicates
    const cleanText = rawText.replace(/\s*\(\d+:\d{2}\)$/, "").trim();
    if (!cleanText) continue;

    let itemMap = categoryItems.get(key);
    if (!itemMap) {
      itemMap = new Map<string, number>();
      categoryItems.set(key, itemMap);
    }

    const currentMinutes = itemMap.get(cleanText) ?? 0;
    itemMap.set(cleanText, currentMinutes + (entry.durationMinutes || 0));
  }

  const result = new Map<CategoryKey, string>();
  for (const [key, itemMap] of categoryItems.entries()) {
    const lines = Array.from(itemMap.entries()).map(([text, minutes]) => {
      const durationStr = formatHMM(minutes);
      return `${text} (${durationStr})`;
    });
    result.set(key, lines.join("\n"));
  }

  return result;
}

/**
 * Notes cells are emitted only when the mapping configures notes columns,
 * notes are included, and the final value is non-empty — an empty value never
 * produces a cell, so sync never blanks a manual note in the sheet.
 */
function notesCells(
  summary: DaySummaryDTO,
  mapping: SheetMapping,
  options: BuildSyncPayloadOptions,
): SyncCellDTO[] {
  const { rowNumber, includeNotes = true, notesOverrides } = options;
  if (!includeNotes || mapping.categoryNotes === undefined) return [];
  const compiled = compileCategoryNotes(summary.timeEntries);
  const cells: SyncCellDTO[] = [];
  for (const key of CATEGORY_KEYS) {
    const value = notesOverrides?.[key] ?? compiled.get(key) ?? "";
    if (value.trim().length === 0) continue;
    cells.push({
      a1: `${mapping.categoryNotes[key]}${rowNumber}`,
      value,
      columnLabel: `${CATEGORY_LABELS[key]} Notes`,
      cellType: "notes",
      categoryKey: key,
    });
  }
  return cells;
}

/**
 * Stable identity of a sync attempt: sha256 over the target row and the
 * a1/value pairs. columnLabel is presentation only — changing a label must
 * not invalidate the payload identity.
 */
export function computePayloadHash(
  rowNumber: number,
  cells: ReadonlyArray<Pick<SyncCellDTO, "a1" | "value">>,
): string {
  const material = JSON.stringify({
    row: rowNumber,
    cells: cells.map((c) => ({ a1: c.a1, value: c.value })),
  });
  return createHash("sha256").update(material).digest("hex");
}

function clockValue(iso: string | null | undefined, timezone: string): string {
  if (!iso) return "";
  return zonedClockHMM(new Date(iso), timezone);
}

function categoryMinutes(
  byCategory: CategoryTotalDTO[],
  key: CategoryKey,
): number {
  return byCategory.find((c) => c.key === key)?.minutes ?? 0;
}

/** "2026-09-03" → "9/3/2026". Non-ISO input passes through unchanged. */
function displayDateValue(workDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(workDate);
  if (!match) return workDate;
  const [, y, m, d] = match;
  return `${Number(m)}/${Number(d)}/${y}`;
}

/**
 * Calculates break start and break end for Google Sheets sync.
 *
 * Company sheet constraint:
 * The sheet has only one pair of break columns: Column C (Break Start) and
 * Column D (Break End), and computes daily attendance via `=(E - B) - (D - C)`.
 * If multiple breaks (or micro-pauses before 12:00) were mapped using their
 * raw first-start and last-end timestamps, the sheet would deduct the entire
 * wall-clock span between them instead of the actual break time taken.
 *
 * To solve this:
 * - If total break minutes is 0 (or no breaks): both cells are empty ("").
 * - If there are multiple breaks OR any break started before 12:00:
 *   All breaks are united starting from "12:00" and ending at "12:00" + totalBreakMinutes
 *   (e.g., total 2h 30m break -> 12:00 to 14:30, deducting exactly 2h 30m).
 * - If there is a single break starting at or after 12:00:
 *   Use the actual break start and end times.
 */
export function computeSheetBreakTimes(
  breaks: readonly BreakDTO[],
  totalBreakMinutes: number,
  timezone: string,
): { breakStart: string; breakEnd: string } {
  if (totalBreakMinutes <= 0 || breaks.length === 0) {
    return { breakStart: "", breakEnd: "" };
  }

  const hasBreakBeforeNoon = breaks.some((b) => {
    const clock = clockValue(b.startedAt, timezone);
    if (!clock) return false;
    const [h] = clock.split(":").map(Number);
    return h !== undefined && !Number.isNaN(h) && h < 12;
  });

  if (hasBreakBeforeNoon || breaks.length > 1) {
    const startMinutes = 12 * 60; // 12:00 in minutes
    const endMinutes = startMinutes + totalBreakMinutes;
    const endHour = Math.floor(endMinutes / 60) % 24;
    const endMinute = endMinutes % 60;
    const breakEnd = `${endHour}:${String(endMinute).padStart(2, "0")}`;
    return {
      breakStart: "12:00",
      breakEnd,
    };
  }

  return {
    breakStart: clockValue(breaks[0]?.startedAt, timezone),
    breakEnd: clockValue(breaks[0]?.endedAt, timezone),
  };
}

