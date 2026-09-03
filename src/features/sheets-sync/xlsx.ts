/**
 * Pure .xlsx pipeline on exceljs — the file-based sibling of google.ts.
 * No db, no auth: load workbook → find mapped worksheet → read date column →
 * write narrow cells → return buffer. Styles and unrelated cells are left
 * untouched (exceljs edits the loaded document in place).
 */
import ExcelJS from "exceljs";

import type { ChangedCell } from "./sync-log-store";
import type { SheetMapping } from "./mapping";
import { columnToIndex } from "./rows";

/** Date rows are scanned within the first 2000 worksheet rows. */
const DATE_SCAN_MAX_ROWS = 2000;

export function isXlsxFileName(name: string): boolean {
  return name.toLowerCase().endsWith(".xlsx");
}

export function isCsvFileName(name: string): boolean {
  return name.toLowerCase().endsWith(".csv");
}

/** Load a workbook from an uploaded buffer. Invalid files throw. */
export async function loadWorkbook(
  buffer: Buffer,
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  // exceljs types want ArrayBuffer; Node Buffers view the same bytes.
  await workbook.xlsx.load(
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer,
  );
  return workbook;
}

export function getWorksheet(
  workbook: ExcelJS.Workbook,
  worksheetName: string,
): ExcelJS.Worksheet {
  const worksheet = workbook.getWorksheet(worksheetName);
  if (!worksheet) {
    throw new Error(`Worksheet "${worksheetName}" not found in the file`);
  }
  return worksheet;
}

/** Date column values (rows 1..2000) as a string matrix, matching rows.ts. */
export function readWorksheetDateColumn(
  worksheet: ExcelJS.Worksheet,
  mapping: SheetMapping,
): string[][] {
  const colIndex = columnToIndex(mapping.dateColumn);
  const rows: string[][] = [];
  for (let r = 1; r <= DATE_SCAN_MAX_ROWS; r += 1) {
    const row = worksheet.getRow(r);
    const value = row.getCell(colIndex + 1).value;
    if (value === null || value === undefined) {
      rows.push([""]);
      continue;
    }
    rows.push([cellToString(value)]);
  }
  return rows;
}

/**
 * Write exactly the given cells (already narrowed by the idempotency check).
 * Only the mapped coordinates are touched; existing styles stay intact.
 */
export function writeWorksheetCells(
  worksheet: ExcelJS.Worksheet,
  cells: ReadonlyArray<{ a1: string; value: string }>,
): void {
  for (const cell of cells) {
    worksheet.getCell(cell.a1).value = cell.value;
  }
}

/** Serialize the edited workbook back to a .xlsx buffer. */
export async function writeWorkbookBuffer(
  workbook: ExcelJS.Workbook,
): Promise<Buffer> {
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

export function extractChangedCells(
  cells: ReadonlyArray<{ a1: string; value: string }>,
): ChangedCell[] {
  return cells.map(({ a1, value }) => ({ a1, value }));
}

/**
 * ExcelJS cell values arrive in many shapes (plain, rich text, formula,
 * hyperlink, date objects). Normalize to the string rows.ts expects:
 * - Date → ISO date string "YYYY-MM-DD" (date cells are the common sheet
 *   format for a date column)
 * - Rich text / formula / hyperlink → their textual content
 */
function cellToString(value: ExcelJS.CellValue): string {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("richText" in value) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("result" in value) {
      // Formula cell: compare against the cached result, like the Google
      // path compares FORMATTED values.
      return cellToString(value.result as ExcelJS.CellValue);
  }
    if ("text" in value) {
      return String(value.text);
    }
    if ("hyperlink" in value && "text" in value) {
      return String(value.text);
    }
    return String(value);
  }
  return String(value);
}
