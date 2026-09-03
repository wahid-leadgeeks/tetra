/**
 * File-based sync orchestration — the .xlsx/.csv sibling of executeSync.
 * Same contract: review gate → mapping config → date row → payload →
 * idempotency check → narrow cell writes → sync log → mark synced.
 * The updated file is returned as a download; nothing is stored server-side.
 */
import { and, eq } from "drizzle-orm";

import { getDaySummary } from "@/features/daily-summary/service";
import type { DaySummaryDTO } from "@/lib/types";
import { db } from "@/server/db";
import { dailyAttendance } from "@/server/db/schema";

import {
  getSyncConfig,
  getUserTimezone,
  type SpreadsheetConfigDTO,
} from "./config";
import {
  dateColumnMatrix,
  parseCsv,
  serializeCsv,
  setCell as setCsvCell,
} from "./csv";
import { SyncNotConfiguredError } from "./errors";
import { buildSyncPayload, computePayloadHash } from "./payload";
import { findDateRow } from "./rows";
import {
  recordSyncLog,
  type ChangedCell,
  type SyncAttemptContext,
} from "./sync-log-store";
import {
  extractChangedCells,
  getWorksheet,
  isCsvFileName,
  isXlsxFileName,
  loadWorkbook,
  readWorksheetDateColumn,
  writeWorkbookBuffer,
  writeWorksheetCells,
} from "./xlsx";

/** Max accepted upload size — the official report stays a small file. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface FileSyncResult {
  status: "success";
  idempotent: boolean;
  changedCells: ChangedCell[];
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export interface FileSyncInput {
  fileName: string;
  buffer: Buffer;
}

export async function executeFileSync(
  userId: string,
  dayKey: string,
  input: FileSyncInput,
): Promise<FileSyncResult> {
  if (input.buffer.byteLength === 0) {
    throw new Error("The uploaded file is empty");
  }
  if (input.buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("File is larger than 5 MB");
  }
  if (!isXlsxFileName(input.fileName) && !isCsvFileName(input.fileName)) {
    throw new Error("Only .xlsx and .csv files are supported");
  }

  const config = await getSyncConfig(userId);
  if (!config) throw new SyncNotConfiguredError("No spreadsheet configured");

  const timezone = await getUserTimezone(userId);
  const summary = await getDaySummary(userId, dayKey, timezone);
  if (summary.reviewState !== "reviewed") {
    throw new Error("Review the day before sync");
  }

  return isCsvFileName(input.fileName)
    ? syncCsv(userId, dayKey, input, config, summary)
    : syncXlsx(userId, dayKey, input, config, summary);
}

async function syncXlsx(
  userId: string,
  dayKey: string,
  input: FileSyncInput,
  config: SpreadsheetConfigDTO,
  summary: DaySummaryDTO,
): Promise<FileSyncResult> {
  let workbook;
  try {
    workbook = await loadWorkbook(input.buffer);
  } catch {
    throw new Error("Could not read the .xlsx file — is it a valid workbook?");
  }

  const ctx: SyncAttemptContext = {
    userId,
    workDate: dayKey,
    configId: config.id,
    payloadHash: null,
  };

  let worksheet;
  try {
    worksheet = getWorksheet(workbook, config.worksheetName);
  } catch (err) {
    await recordFailure(ctx, err);
    throw err;
  }

  const dateRows = readWorksheetDateColumn(worksheet, config.mapping);
  const rowNumber = findDateRow(dateRows, config.mapping, dayKey);
  if (rowNumber === null) {
    const err = dateRowNotFound(dayKey, config.mapping.dateColumn);
    await recordFailure(ctx, err);
    throw err;
  }

  const { cells } = buildSyncPayload(summary, config.mapping, {
    dateValueFormat: "iso",
    rowNumber,
    timezone: config.timezone,
  });

  const currentValues = cells.map((cell) => {
    const value = worksheet.getCell(cell.a1).value;
    return value === null || value === undefined ? "" : String(value);
  });
  const cellsToWrite = cells.filter(
    (cell, i) => currentValues[i] !== cell.value,
  );

  if (cellsToWrite.length > 0) {
    writeWorksheetCells(worksheet, cellsToWrite);
  }
  const buffer =
    cellsToWrite.length > 0
      ? await writeWorkbookBuffer(workbook)
      : input.buffer;

  return finish(
    ctx,
    rowNumber,
    cells,
    cellsToWrite,
    buffer,
    input.fileName,
    XLSX_MIME,
    userId,
    dayKey,
  );
}

async function syncCsv(
  userId: string,
  dayKey: string,
  input: FileSyncInput,
  config: SpreadsheetConfigDTO,
  summary: DaySummaryDTO,
): Promise<FileSyncResult> {
  const sheet = parseCsv(input.buffer.toString("utf-8"));

  const ctx: SyncAttemptContext = {
    userId,
    workDate: dayKey,
    configId: config.id,
    payloadHash: null,
  };

  const matrix = dateColumnMatrix(sheet.rows, config.mapping);
  const rowNumber = findDateRow(matrix, config.mapping, dayKey);
  if (rowNumber === null) {
    const err = dateRowNotFound(dayKey, config.mapping.dateColumn);
    await recordFailure(ctx, err);
    throw err;
  }

  const { cells } = buildSyncPayload(summary, config.mapping, {
    dateValueFormat: "iso",
    rowNumber,
    timezone: config.timezone,
  });

  const currentValues = cells.map((cell) => csvCellValue(sheet.rows, cell.a1));
  const cellsToWrite = cells.filter(
    (cell, i) => currentValues[i] !== cell.value,
  );

  let buffer = input.buffer;
  if (cellsToWrite.length > 0) {
    for (const cell of cellsToWrite) {
      setCsvCell(sheet, a1Row(cell.a1) - 1, a1ColumnIndex(cell.a1), cell.value);
    }
    buffer = Buffer.from(serializeCsv(sheet.rows), "utf-8");
  }

  return finish(
    ctx,
    rowNumber,
    cells,
    cellsToWrite,
    buffer,
    input.fileName,
    "text/csv",
    userId,
    dayKey,
  );
}

async function finish(
  ctx: SyncAttemptContext,
  rowNumber: number,
  cells: ReadonlyArray<{ a1: string; value: string }>,
  cellsToWrite: ReadonlyArray<{ a1: string; value: string }>,
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  userId: string,
  dayKey: string,
): Promise<FileSyncResult> {
  const payloadHash = computePayloadHash(rowNumber, cells);
  const changedCells = extractChangedCells(cellsToWrite);

  await recordSyncLog(
    { ...ctx, payloadHash },
    {
      status: "success",
      payloadHash,
      changedCells,
      errorMessage: null,
    },
  );
  await markSynced(userId, dayKey);

  return {
    status: "success",
    idempotent: cellsToWrite.length === 0,
    changedCells,
    buffer,
    fileName,
    mimeType,
  };
}

async function recordFailure(
  ctx: SyncAttemptContext,
  err: unknown,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  await recordSyncLog(ctx, {
    status: "failed",
    payloadHash: ctx.payloadHash,
    changedCells: [],
    errorMessage: message,
  });
}

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

function dateRowNotFound(dayKey: string, dateColumn: string): Error {
  return new Error(
    `Date row not found: no row for ${dayKey} in column ${dateColumn}`,
  );
}

function csvCellValue(rows: string[][], a1: string): string {
  const row = rows[a1Row(a1) - 1];
  return row?.[a1ColumnIndex(a1)] ?? "";
}

function a1Row(a1: string): number {
  const digits = /\d+/.exec(a1);
  return digits ? Number(digits[0]) : 0;
}

function a1ColumnIndex(a1: string): number {
  const letters = /^[A-Z]+/.exec(a1);
  if (!letters) return 0;
  let index = 0;
  for (const ch of letters[0]) {
    index = index * 26 + (ch.charCodeAt(0) - "A".charCodeAt(0) + 1);
  }
  return index - 1;
}

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
