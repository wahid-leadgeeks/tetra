/**
 * Pure CSV codec — the file-based sibling of google.ts for .csv uploads.
 * RFC-4180-style: quotes wrap values containing commas, quotes, or newlines;
 * embedded quotes double. Serializing parsed rows round-trips the values
 * byte-for-byte when the input is well-formed.
 */
import { columnToIndex } from "./rows";
import type { SheetMapping } from "./mapping";

export interface CsvSheet {
  /** Row-major string matrix; row 0 is worksheet row 1. */
  rows: string[][];
  /** 1-based row number the next append would land on. */
  rowCount: number;
}

export function parseCsv(text: string): CsvSheet {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  // Track CRLF/LF so "\r\n" inside quotes stays intact but line breaks
  // outside quotes split rows.
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i += ch === "\r" ? 2 : 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Final field/row without trailing newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return { rows, rowCount: rows.length };
}

export function serializeCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map(quoteField).join(","))
    .join("\r\n")
    .concat("\r\n");
}

/**
 * Update one cell (1-based row, 0-based col index) in the row matrix,
 * growing the matrix with empty rows/fields as needed.
 */
export function setCell(
  sheet: CsvSheet,
  rowIndex0: number,
  colIndex: number,
  value: string,
): void {
  while (sheet.rows.length <= rowIndex0) {
    sheet.rows.push([]);
  }
  const row = sheet.rows[rowIndex0];
  while (row.length <= colIndex) {
    row.push("");
  }
  row[colIndex] = value;
}

/** Date column values as the string matrix rows.ts expects. */
export function dateColumnMatrix(
  rows: string[][],
  mapping: SheetMapping,
): string[][] {
  const colIndex = columnToIndex(mapping.dateColumn);
  return rows.map((row) => [row?.[colIndex] ?? ""]);
}

function quoteField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}
