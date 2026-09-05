/**
 * Pure sync payload generation (ARCHITECTURE.md sync flow: "Generate payload").
 * No db, no google — unit-testable with fixture DaySummaryDTO objects.
 */
import { createHash } from "node:crypto";
import { formatHMM, zonedClock } from "@/lib/time";
import type {
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
 * - Clock in/out: "HH:mm" in the summary timezone; "" when attendance is
 *   missing or clock-out is not set — an empty string clears a stale sheet
 *   value on resync. The 'reviewed' gate normally guarantees both exist.
 * - Break start: first break's start. Break end: last break's end. "" when
 *   there are no breaks (clears stale values), and "" for break end while the
 *   last break is still open — cannot happen on a reviewed day, but empty is
 *   the honest value.
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
  const lastBreak = breaks.length > 0 ? breaks[breaks.length - 1] : undefined;

  const cells: SyncCellDTO[] = [
    {
      a1: `${mapping.clockInColumn}${rowNumber}`,
      value: clockValue(attendance?.clockInAt, timezone),
      columnLabel: "Clock In",
    },
    {
      a1: `${mapping.breakStartColumn}${rowNumber}`,
      value: clockValue(breaks[0]?.startedAt, timezone),
      columnLabel: "Break Start",
    },
    {
      a1: `${mapping.breakEndColumn}${rowNumber}`,
      value: clockValue(lastBreak?.endedAt, timezone),
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
 * the day's completed entries, notes first with the task name as fallback,
 * deduplicated in first-occurrence order, joined by newlines to match the
 * sheet's manual format.
 */
export function compileCategoryNotes(
  entries: readonly TimeEntryDTO[],
): Map<CategoryKey, string> {
  const notesByCategory = new Map<CategoryKey, string[]>();
  for (const entry of entries) {
    if (entry.status !== "completed") continue;
    const key = CATEGORY_KEYS.find((k) => k === entry.categoryKey);
    if (key === undefined) continue;
    const text = entry.notes?.trim() || entry.taskName.trim();
    if (!text) continue;
    const list = notesByCategory.get(key) ?? [];
    if (!list.includes(text)) list.push(text);
    notesByCategory.set(key, list);
  }
  return new Map(
    [...notesByCategory.entries()].map(([k, v]) => [k, v.join("\n")]),
  );
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
  return zonedClock(new Date(iso), timezone);
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
