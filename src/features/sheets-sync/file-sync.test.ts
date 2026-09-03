import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { findDateRow } from "./rows";
import { DEFAULT_SHEET_MAPPING } from "./mapping";
import {
  loadWorkbook,
  getWorksheet,
  readWorksheetDateColumn,
  writeWorksheetCells,
  writeWorkbookBuffer,
  isXlsxFileName,
  isCsvFileName,
} from "./xlsx";
import { parseCsv, serializeCsv, setCell, dateColumnMatrix } from "./csv";

const MAPPING = {
  ...DEFAULT_SHEET_MAPPING,
  dateColumn: "A",
  clockInColumn: "B",
  breakStartColumn: "C",
  breakEndColumn: "D",
  clockOutColumn: "E",
  dailyTotalColumn: "F",
  workTotalColumn: "G",
  categories: {
    website_management: "I",
    cyber_security: "J",
    technology_innovation: "K",
    infrastructure_management: "L",
    research: "M",
    meeting: "N",
    training: "O",
    other_tasks: "P",
  },
};

async function fixtureWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(["Date", "Clock In", "Break Start", "Break End", "Clock Out", "Daily Total", "Work Total", "Notes"]);
  ws.addRow(["2026-09-04", "08:00", "", "", "", "0:00", "0:00", "keep me"]);
  ws.addRow(["2026-09-05", "08:00", "", "", "", "0:00", "0:00", "keep me too"]);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

describe("xlsx file sync pipeline", () => {
  it("detects file types by extension", () => {
    expect(isXlsxFileName("report.XLSX")).toBe(true);
    expect(isXlsxFileName("report.csv")).toBe(false);
    expect(isCsvFileName("report.CSV")).toBe(true);
    expect(isCsvFileName("report.xlsx")).toBe(false);
  });

  it("round-trips: load → find row → write narrow cells → reload sees values, unrelated cells intact", async () => {
    const buffer = await fixtureWorkbook();
    const workbook = await loadWorkbook(buffer);
    const ws = getWorksheet(workbook, "Sheet1");

    const dateRows = readWorksheetDateColumn(ws, MAPPING);
    expect(findDateRow(dateRows, MAPPING, "2026-09-05")).toBe(3);

    writeWorksheetCells(ws, [
      { a1: "B3", value: "08:45" },
      { a1: "G3", value: "7:22" },
    ]);

    const outBuffer = await writeWorkbookBuffer(workbook);
    const reloaded = await loadWorkbook(outBuffer);
    const reWs = getWorksheet(reloaded, "Sheet1");

    expect(reWs.getCell("B3").value).toBe("08:45");
    expect(reWs.getCell("G3").value).toBe("7:22");
    // Unrelated cells untouched
    expect(reWs.getCell("H3").value).toBe("keep me too");
    expect(reWs.getCell("B2").value).toBe("08:00");
    expect(reWs.getCell("A1").value).toBe("Date");
  });

  it("normalizes date cells to ISO strings for findDateRow", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow(["Date"]);
    ws.addRow([new Date(Date.UTC(2026, 8, 4))]);
    const buffer = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

    const workbook = await loadWorkbook(buffer);
    const dateRows = readWorksheetDateColumn(
      getWorksheet(workbook, "Sheet1"),
      MAPPING,
    );
    expect(dateRows[1][0]).toBe("2026-09-04");
    expect(findDateRow(dateRows, MAPPING, "2026-09-04")).toBe(2);
  });

  it("throws on a missing worksheet", async () => {
    const buffer = await fixtureWorkbook();
    const workbook = await loadWorkbook(buffer);
    expect(() => getWorksheet(workbook, "Nope")).toThrow(/not found/i);
  });
});

describe("csv codec", () => {
  it("parses plain rows and finds the date row", () => {
    const csv = "Date,Clock In\n2026-09-04,08:00\n2026-09-05,08:00\n";
    const sheet = parseCsv(csv);
    expect(sheet.rows).toHaveLength(3);
    expect(sheet.rowCount).toBe(3);
    const matrix = dateColumnMatrix(sheet.rows, MAPPING);
    expect(findDateRow(matrix, MAPPING, "2026-09-05")).toBe(3);
  });

  it("round-trips values containing commas and quotes", () => {
    const rows = [["a,b", 'say "hi"', "plain"], ["2026-09-04", "08:00", ""]];
    const text = serializeCsv(rows);
    const parsed = parseCsv(text);
    expect(parsed.rows[0][0]).toBe("a,b");
    expect(parsed.rows[0][1]).toBe('say "hi"');
    expect(parsed.rows[1][0]).toBe("2026-09-04");
  });

  it("setCell writes and grows the matrix", () => {
    const sheet = parseCsv("Date\n2026-09-04\n");
    setCell(sheet, 1, 1, "08:45");
    expect(sheet.rows[1][1]).toBe("08:45");
    setCell(sheet, 0, 5, "x");
    expect(sheet.rows[0][5]).toBe("x");
    // gap filled with empty strings
    expect(sheet.rows[0][3]).toBe("");
  });

  it("handles CRLF line endings", () => {
    const csv = "Date,Clock In\r\n2026-09-04,08:00\r\n";
    const sheet = parseCsv(csv);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[1][0]).toBe("2026-09-04");
    expect(sheet.rows[1][1]).toBe("08:00");
  });
});
