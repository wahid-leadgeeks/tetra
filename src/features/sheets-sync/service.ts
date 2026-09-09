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
import { zonedClockHMM } from "@/lib/time";
import { db } from "@/server/db";
import { dailyAttendance } from "@/server/db/schema";
import type { CategoryKey } from "./mapping";
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

/**
 * Per-sync choices from the preview dialog: whether compiled category notes
 * are written to the mapped notes columns, plus user edits of those notes.
 * Defaults mirror the preview toggle: notes included, unedited.
 */
export interface SyncOptions {
  includeNotes?: boolean;
  notes?: Partial<Record<CategoryKey, string>>;
  /** Allow sync even if the day is not yet reviewed (e.g. for auto-syncing tasks on Timeline). */
  allowUnreviewed?: boolean;
  /** When true, only sync category durations and notes; do not touch attendance or totals. */
  tasksOnly?: boolean;
}

export interface SyncResult {
  status: "success";
  changedCells: ChangedCell[];
  /** True when the sheet already matched the payload and nothing was written. */
  idempotent: boolean;
}

// ---------------------------------------------------------------------------
// Public surface (re-exported for route handlers and UI agents)
// ---------------------------------------------------------------------------

export { getSyncConfig, upsertSyncConfig, updateSyncConfigMapping } from "./config";
export type { SpreadsheetConfigDTO } from "./config";
export {
  listSyncLogs,
  recordSyncLog,
} from "./sync-log-store";
export type { ListSyncLogsOptions, ChangedCell } from "./sync-log-store";
export { SyncNotConfiguredError, SheetsApiError } from "./errors";
export { getSheetsClient, testReadSpreadsheet } from "./google";
export type {
  GetSheetsClientOptions,
  TestReadSpreadsheetResult,
} from "./google";
export { pullDayFromSheet } from "./pull";

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
  options?: { accessToken?: string },
): Promise<SyncPreviewDTO> {
  const config = await getSyncConfig(userId);
  if (!config) throw new SyncNotConfiguredError("No spreadsheet configured");
  const sheets = await getSheetsClient({
    userId,
    accessToken: options?.accessToken,
  });
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
    includeNotes: true,
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
  options: SyncOptions & { accessToken?: string } = {},
): Promise<SyncResult> {
  const timezone = await getUserTimezone(userId);
  const summary = await getDaySummary(userId, dayKey, timezone);
  if (
    !options.allowUnreviewed &&
    !options.tasksOnly &&
    summary.reviewState !== "reviewed"
  ) {
    throw new Error("Review the day before sync");
  }

  const config = await getSyncConfig(userId);
  if (!config) throw new SyncNotConfiguredError("No spreadsheet configured");
  const sheets = await getSheetsClient({
    userId,
    accessToken: options.accessToken,
  });
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
    includeNotes: options.includeNotes ?? true,
    notesOverrides: options.notes,
    tasksOnly: options.tasksOnly,
  });
  const payloadHash = computePayloadHash(rowNumber, cells);
  const writeCtx: SyncAttemptContext = { ...readCtx, payloadHash };

  const { formattedValues, formulaValues } = await googleStep(writeCtx, () =>
    readCurrentCellValues(sheets, config, cells),
  );
  const cellsToWrite = cells.filter((cell, i) => {
    const formula = formulaValues[i];
    // Formula preservation: Never overwrite spreadsheet formula cells (e.g. =(E-B)-(D-C) or =SUMIF(...))
    if (typeof formula === "string" && formula.startsWith("=")) {
      return false;
    }
    return formattedValues[i] !== cell.value;
  });

  const isReviewed = summary.reviewState === "reviewed";

  if (cellsToWrite.length === 0) {
    await recordSyncLog(writeCtx, {
      status: "success",
      payloadHash,
      changedCells: [],
      errorMessage: null,
    });
    await markSynced(userId, dayKey, { setSyncedState: isReviewed });
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
  await markSynced(userId, dayKey, { setSyncedState: isReviewed });
  return { status: "success", changedCells, idempotent: false };
}

export interface ClockInSyncResult {
  attempted: boolean;
  success?: boolean;
  cell?: string;
  value?: string;
  idempotent?: boolean;
  message?: string;
}

/**
 * Syncs clock-in time to Google Sheets immediately when work starts.
 * Finds the date row and updates ONLY the mapped clockInColumn cell.
 * Idempotent, logged in sync_logs, and non-blocking for attendance.
 */
export async function syncClockIn(
  userId: string,
  workDate: string,
  clockInAt: Date | string,
  options: { accessToken?: string } = {},
): Promise<ClockInSyncResult> {
  const config = await getSyncConfig(userId);
  if (!config) return { attempted: false };
  if (config.mapping.autoSyncOnClockIn === false) return { attempted: false };

  const sheets = await getSheetsClient({
    userId,
    accessToken: options.accessToken,
  });
  if (!sheets) {
    return {
      attempted: true,
      success: false,
      message: "Google Sheets credentials not configured",
    };
  }

  const timezone = await getUserTimezone(userId);
  const clockDate =
    typeof clockInAt === "string" ? new Date(clockInAt) : clockInAt;
  const clockInTime = zonedClockHMM(clockDate, timezone);

  const ctx: SyncAttemptContext = {
    userId,
    workDate,
    configId: config.id,
    payloadHash: null,
  };

  try {
    const dateRows = await readDateColumn(sheets, config);
    const rowNumber = findDateRow(dateRows, config.mapping, workDate);
    if (rowNumber === null) {
      const msg = `Date ${workDate} was not found in worksheet "${config.worksheetName}"`;
      await recordSyncLog(ctx, {
        status: "failed",
        payloadHash: null,
        changedCells: [],
        errorMessage: msg,
      });
      return { attempted: true, success: false, message: msg };
    }

    const a1 = `${config.mapping.clockInColumn}${rowNumber}`;
    const range = worksheetRange(config.worksheetName, a1);

    // Check existing cell value for idempotency
    const currentRes = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range,
    });
    const currentVal = currentRes.data.values?.[0]?.[0];
    const currentStr =
      currentVal !== undefined && currentVal !== null
        ? String(currentVal).trim()
        : "";

    if (currentStr === clockInTime) {
      await recordSyncLog(ctx, {
        status: "success",
        payloadHash: null,
        changedCells: [],
        errorMessage: null,
      });
      return {
        attempted: true,
        success: true,
        cell: a1,
        value: clockInTime,
        idempotent: true,
      };
    }

    // Write ONLY the clockIn cell
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[clockInTime]],
      },
    });

    await recordSyncLog(ctx, {
      status: "success",
      payloadHash: null,
      changedCells: [{ a1, value: clockInTime }],
      errorMessage: null,
    });

    return {
      attempted: true,
      success: true,
      cell: a1,
      value: clockInTime,
      idempotent: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordSyncLog(ctx, {
      status: "failed",
      payloadHash: null,
      changedCells: [],
      errorMessage: message,
    });
    return { attempted: true, success: false, message };
  }
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

/** Current FORMATTED values and FORMULAS of target cells, aligned with `cells`. */
async function readCurrentCellValues(
  sheets: sheets_v4.Sheets,
  config: SpreadsheetConfigDTO,
  cells: SyncCellDTO[],
): Promise<{ formattedValues: string[]; formulaValues: string[] }> {
  const ranges = cells.map((cell) =>
    worksheetRange(config.worksheetName, cell.a1),
  );
  const [formattedRes, formulaRes] = await Promise.all([
    sheets.spreadsheets.values.batchGet({
      spreadsheetId: config.spreadsheetId,
      ranges,
      valueRenderOption: "FORMATTED_VALUE",
    }),
    sheets.spreadsheets.values.batchGet({
      spreadsheetId: config.spreadsheetId,
      ranges,
      valueRenderOption: "FORMULA",
    }),
  ]);
  const formattedRanges = formattedRes.data.valueRanges ?? [];
  const formulaRanges = formulaRes.data.valueRanges ?? [];
  return {
    formattedValues: cells.map((cell, i) => {
      const raw = formattedRanges[i]?.values?.[0]?.[0];
      return raw === undefined || raw === null ? "" : String(raw);
    }),
    formulaValues: cells.map((cell, i) => {
      const raw = formulaRanges[i]?.values?.[0]?.[0];
      return raw === undefined || raw === null ? "" : String(raw);
    }),
  };
}

/**
 * One batchUpdate of exactly the given mapped cells (already filtered to the
 * differing ones). valueInputOption USER_ENTERED: values ("7:22", "8:00") are
 * parsed according to the spreadsheet's cell formats so times and durations
 * are stored as native time values matching the actual spreadsheet source.
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
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}

/** Success terminal state: attendance marked synced + lastSyncedAt. */
async function markSynced(
  userId: string,
  workDate: string,
  options?: { setSyncedState?: boolean },
): Promise<void> {
  const setSynced = options?.setSyncedState ?? true;
  await db
    .update(dailyAttendance)
    .set({
      lastSyncedAt: new Date(),
      ...(setSynced ? { reviewState: "synced" } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(dailyAttendance.userId, userId),
        eq(dailyAttendance.workDate, workDate),
      ),
    );
}
