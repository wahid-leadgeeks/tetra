/**
 * Sheets Sync orchestration — the ARCHITECTURE.md flow:
 * summary → review gate → date row → payload → idempotency check → narrow
 * cell writes → sync log → mark synced.
 *
 * Structure: config.ts (persistence), google.ts (client + ranges),
 * sync-log-store.ts (audit trail), payload.ts/rows.ts/mapping.ts (pure).
 * This module owns the flow ONLY. Public surface is re-exported here so UI
 * agents import from "@/features/sheets-sync/service".
 */
import { and, eq } from "drizzle-orm";
import type { sheets_v4 } from "googleapis";
import { getDaySummary } from "@/features/daily-summary/service";
import type { SyncPreviewDTO, SyncCellDTO } from "@/lib/types";
import { db } from "@/server/db";
import { dailyAttendance } from "@/server/db/schema";
import { SyncNotConfiguredError, SheetsApiError } from "./errors";
import {
  getSyncConfig,
  getUserTimezone,
  type SpreadsheetConfigDTO,
} from "./config";
import { getSheetsClient, worksheetRange } from "./google";
import { buildSyncPayload, computePayloadHash } from "./payload";
import { findDateRow } from "./rows";
import {
  recordSyncLog,
  type ChangedCell,
  type SyncAttemptContext,
} from "./sync-log-store";

/** Date rows are scanned within the first 2000 worksheet rows. */
const DATE_SCAN_MAX_ROWS = 2000;

export interface SyncResult {
  status: "success";
  changedCells: ChangedCell[];
  /** True when the sheet already matched the payload and nothing was written. */
  idempotent: boolean;
}

// ---------------------------------------------------------------------------
// Public surface (re-exported for route handlers and UI agents)
// ---------------------------------------------------------------------------

export { getSyncConfig, upsertSyncConfig } from "./config";
export type { SpreadsheetConfigDTO } from "./config";
export {
  listSyncLogs,
  recordSyncLog,
} from "./sync-log-store";
export type { ListSyncLogsOptions, ChangedCell } from "./sync-log-store";
export { SyncNotConfiguredError, SheetsApiError } from "./errors";
export { getSheetsClient } from "./google";

// ---------------------------------------------------------------------------
// Preview & sync
// ---------------------------------------------------------------------------

/**
 * Read-only preview: resolves the date row and the exact cells that would be
 * written. No review gate — previewing before review is allowed.
 */
export async function previewSync(
  userId: string,
  dayKey: string,
): Promise<SyncPreviewDTO> {
  const config = await getSyncConfig(userId);
  if (!config) throw new SyncNotConfiguredError("No spreadsheet configured");
  const sheets = getSheetsClient();
  if (!sheets) {
    throw new SyncNotConfiguredError(
      "Google Sheets credentials not configured",
    );
  }

  const timezone = await getUserTimezone(userId);
  const summary = await getDaySummary(userId, dayKey, timezone);

  const dateRows = await readDateColumn(sheets, config);
  const rowNumber = findDateRow(dateRows, config.mapping, dayKey);
  if (rowNumber === null) throw new Error("Date row not found");

  const { cells } = buildSyncPayload(summary, config.mapping, {
    dateValueFormat: "iso",
    rowNumber,
    timezone,
  });
  return { workDate: dayKey, rowNumber, cells };
}

/**
 * Execute the sync flow. Idempotent: when every target cell already holds the
 * computed value, nothing is written, the attempt is logged as success with
 * empty changedCells, and the day is marked synced. Google API failures are
 * logged as failed syncs and rethrown as SheetsApiError — the day stays
 * 'reviewed' so the user can retry.
 */
export async function executeSync(
  userId: string,
  dayKey: string,
): Promise<SyncResult> {
  const timezone = await getUserTimezone(userId);
  const summary = await getDaySummary(userId, dayKey, timezone);
  if (summary.reviewState !== "reviewed") {
    throw new Error("Review the day before sync");
  }

  const config = await getSyncConfig(userId);
  if (!config) throw new SyncNotConfiguredError("No spreadsheet configured");
  const sheets = getSheetsClient();
  if (!sheets) {
    throw new SyncNotConfiguredError(
      "Google Sheets credentials not configured",
    );
  }

  const readCtx: SyncAttemptContext = {
    userId,
    workDate: dayKey,
    configId: config.id,
    payloadHash: null,
  };
  const dateRows = await googleStep(readCtx, () =>
    readDateColumn(sheets, config),
  );

  const rowNumber = findDateRow(dateRows, config.mapping, dayKey);
  if (rowNumber === null) throw new Error("Date row not found");

  const { cells } = buildSyncPayload(summary, config.mapping, {
    dateValueFormat: "iso",
    rowNumber,
    timezone,
  });
  const payloadHash = computePayloadHash(rowNumber, cells);
  const writeCtx: SyncAttemptContext = { ...readCtx, payloadHash };

  const currentValues = await googleStep(writeCtx, () =>
    readCurrentCellValues(sheets, config, cells),
  );
  const cellsToWrite = cells.filter(
    (cell, i) => currentValues[i] !== cell.value,
  );

  if (cellsToWrite.length === 0) {
    await recordSyncLog(writeCtx, {
      status: "success",
      payloadHash,
      changedCells: [],
      errorMessage: null,
    });
    await markSynced(userId, dayKey);
    return { status: "success", changedCells: [], idempotent: true };
  }

  // Write ONLY the differing mapped cells — never whole rows, never
  // unrelated columns, never a cell that already matches (a formula that
  // evaluates to the same value is left untouched).
  await googleStep(writeCtx, () => writeCells(sheets, config, cellsToWrite));

  // Writes completed — only now are success recorded and the day marked.
  const changedCells: ChangedCell[] = cellsToWrite.map(({ a1, value }) => ({
    a1,
    value,
  }));
  await recordSyncLog(writeCtx, {
    status: "success",
    payloadHash,
    changedCells,
    errorMessage: null,
  });
  await markSynced(userId, dayKey);
  return { status: "success", changedCells, idempotent: false };
}

// ---------------------------------------------------------------------------
// Google steps
// ---------------------------------------------------------------------------

/**
 * Runs one Google API step. On failure the attempt is logged as failed and
 * the error is rethrown as SheetsApiError.
 */
async function googleStep<T>(
  ctx: SyncAttemptContext,
  step: () => Promise<T>,
): Promise<T> {
  try {
    return await step();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordSyncLog(ctx, {
      status: "failed",
      payloadHash: ctx.payloadHash,
      changedCells: [],
      errorMessage: message,
    });
    throw new SheetsApiError(message);
  }
}

/** Date column values, rows 1..2000, as a string matrix. */
async function readDateColumn(
  sheets: sheets_v4.Sheets,
  config: SpreadsheetConfigDTO,
): Promise<string[][]> {
  const dateColumn = config.mapping.dateColumn;
  const range = worksheetRange(
    config.worksheetName,
    `${dateColumn}1:${dateColumn}${DATE_SCAN_MAX_ROWS}`,
  );
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range,
  });
  return res.data.values ?? [];
}

/** Current FORMATTED values of the target cells, aligned with `cells`. */
async function readCurrentCellValues(
  sheets: sheets_v4.Sheets,
  config: SpreadsheetConfigDTO,
  cells: SyncCellDTO[],
): Promise<string[]> {
  const ranges = cells.map((cell) =>
    worksheetRange(config.worksheetName, cell.a1),
  );
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: config.spreadsheetId,
    ranges,
  });
  const valueRanges = res.data.valueRanges ?? [];
  return cells.map((cell, i) => {
    const raw = valueRanges[i]?.values?.[0]?.[0];
    return raw === undefined || raw === null ? "" : String(raw);
  });
}

/**
 * One batchUpdate of exactly the given mapped cells (already filtered to the
 * differing ones). valueInputOption RAW: the exact computed strings ("7:22",
 * "08:00") are stored verbatim — no locale-dependent reinterpretation, so an
 * idempotent read-back compares equal.
 */
async function writeCells(
  sheets: sheets_v4.Sheets,
  config: SpreadsheetConfigDTO,
  cells: SyncCellDTO[],
): Promise<void> {
  const data = cells.map((cell) => ({
    range: worksheetRange(config.worksheetName, cell.a1),
    values: [[cell.value]],
  }));
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: config.spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });
}

/** Success terminal state: attendance marked synced + lastSyncedAt. */
async function markSynced(userId: string, workDate: string): Promise<void> {
  await db
    .update(dailyAttendance)
    .set({
      lastSyncedAt: new Date(),
      reviewState: "synced",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(dailyAttendance.userId, userId),
        eq(dailyAttendance.workDate, workDate),
      ),
    );
}
