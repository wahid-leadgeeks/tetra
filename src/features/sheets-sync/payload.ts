/**
 * Pure sync payload generation (ARCHITECTURE.md sync flow: "Generate payload").
 * No db, no google — unit-testable with fixture DaySummaryDTO objects.
 */
import { createHash } from "node:crypto";
import { formatHMM, zonedClock } from "@/lib/time";
import type { CategoryTotalDTO, DaySummaryDTO, SyncCellDTO } from "@/lib/types";
import { CATEGORY_KEYS, type CategoryKey, type SheetMapping } from "./mapping";

/** How the date cell value renders: "2026-09-03" (iso) vs "9/3/2026" (display). */
export type DateValueFormat = "iso" | "display";

export interface BuildSyncPayloadOptions {
  dateValueFormat: DateValueFormat;
  /** 1-based spreadsheet row of the target date (from findDateRow). */
  rowNumber: number;
  /** IANA timezone the summary was computed in — clock values render in it. */
  timezone: string;
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
 * - The notes column is intentionally NOT written (see mapping.ts).
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
