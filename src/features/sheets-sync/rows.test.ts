import { describe, expect, it } from "vitest";
import { MAPPING } from "./test-fixtures";
import { findDateRow } from "./rows";

describe("findDateRow", () => {
  it("finds an ISO YYYY-MM-DD cell and returns the 1-based row number", () => {
    // Given a worksheet whose date column holds ISO dates under a header
    const rows = [
      ["Date"],
      ["2026-09-02"],
      ["2026-09-03"],
      ["2026-09-04"],
    ];
    // When searching for 2026-09-03
    const row = findDateRow(rows, MAPPING, "2026-09-03");
    // Then the 1-based spreadsheet row is returned
    expect(row).toBe(3);
  });

  it("finds a US display date M/D/YYYY", () => {
    // Given a worksheet using "9/3/2026" style dates
    const rows = [["Date"], ["9/2/2026"], ["9/3/2026"]];
    // When searching for 2026-09-03
    const row = findDateRow(rows, MAPPING, "2026-09-03");
    // Then the row matches
    expect(row).toBe(3);
  });

  it("finds a day-first display date D/M/YYYY", () => {
    // Given a worksheet using day-first "04/09/2026" style dates
    const rows = [["Date"], ["03/09/2026"], ["04/09/2026"]];
    // When searching for 2026-09-04
    const row = findDateRow(rows, MAPPING, "2026-09-04");
    // Then the day-first interpretation matches
    expect(row).toBe(3);
  });

  it("finds a textual date like 'Sep 3, 2026'", () => {
    // Given a worksheet with a locale-text date
    const rows = [["Date"], ["Sep 2, 2026"], ["Sep 3, 2026"]];
    // When searching for 2026-09-03
    const row = findDateRow(rows, MAPPING, "2026-09-03");
    // Then the Date.parse fallback matches
    expect(row).toBe(3);
  });

  it("returns null when no row matches the target date", () => {
    // Given a worksheet that does not contain the target date
    const rows = [["Date"], ["2026-09-02"], ["2026-09-04"]];
    // When searching for 2026-09-03
    const row = findDateRow(rows, MAPPING, "2026-09-03");
    // Then no row is found
    expect(row).toBe(null);
  });

  it("never matches the header row itself", () => {
    // Given a header row that reads "Date" and a mapping with headerRow 1
    const rows = [["Date"], ["2026-09-03"]];
    // When searching for 2026-09-03
    const row = findDateRow(rows, MAPPING, "2026-09-03");
    // Then the first data row after the header is returned, not row 1
    expect(row).toBe(2);
  });

  it("scans from the first spreadsheet row when headerRow is absent", () => {
    // Given a headerless worksheet and a mapping without headerRow
    const noHeader = { ...MAPPING };
    delete noHeader.headerRow;
    const rows = [["2026-09-02"], ["2026-09-03"]];
    // When searching for 2026-09-03
    const row = findDateRow(rows, noHeader, "2026-09-03");
    // Then row 2 matches
    expect(row).toBe(2);
  });

  it("ignores non-date cells and invalid calendar dates", () => {
    // Given a worksheet containing garbage and a rollover date (Feb 30)
    const rows = [
      ["Date"],
      [""],
      ["not a date"],
      ["2/30/2026"],
      ["2026-09-03"],
    ];
    // When searching for 2026-09-03
    const row = findDateRow(rows, MAPPING, "2026-09-03");
    // Then only the valid date row matches
    expect(row).toBe(5);
  });

  it("reads the date from the mapped date column, not column A", () => {
    // Given a mapping whose date column is D
    const mapping = { ...MAPPING, dateColumn: "D" };
    const rows = [
      ["", "", "", "Date"],
      ["x", "y", "z", "2026-09-03"],
    ];
    // When searching for 2026-09-03
    const row = findDateRow(rows, mapping, "2026-09-03");
    // Then the row matching in column D is returned
    expect(row).toBe(2);
  });

  it("returns null for an empty worksheet", () => {
    // Given no rows at all
    // When searching
    const row = findDateRow([], MAPPING, "2026-09-03");
    // Then no row is found
    expect(row).toBe(null);
  });
});
