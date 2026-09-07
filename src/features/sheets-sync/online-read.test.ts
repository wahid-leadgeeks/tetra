import { describe, expect, it, vi, beforeEach } from "vitest";
import { testReadSpreadsheet } from "./google";

// Mock database
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

// Mock googleapis
const mockSpreadsheetsGet = vi.fn();
const mockValuesGet = vi.fn();

vi.mock("googleapis", () => {
  return {
    google: {
      auth: {
        OAuth2: vi.fn().mockImplementation(() => ({
          setCredentials: vi.fn(),
          refreshAccessToken: vi.fn().mockResolvedValue({
            credentials: {
              access_token: "refreshed_token",
              expiry_date: Date.now() + 3600_000,
            },
          }),
        })),
        JWT: vi.fn().mockImplementation(() => ({})),
      },
      sheets: vi.fn().mockImplementation(() => ({
        spreadsheets: {
          get: mockSpreadsheetsGet,
          values: {
            get: mockValuesGet,
          },
        },
      })),
    },
  };
});

describe("Google Sheets Online Reading & Inspection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  });

  it("fails gracefully when no Google credentials (OAuth or Service Account) are available", async () => {
    const result = await testReadSpreadsheet({
      spreadsheetId: "1Rup5jNnSu-oTcOlZC3zIN7MNfzHqcP_rNrhnLIsX89Y",
      worksheetName: "Wahid",
      sheetGid: "1976323691",
    });

    expect(result.ok).toBe(false);
    expect(result.authMethod).toBe("none");
    expect(result.error).toContain("No Google credentials available");
  });

  it("reads online spreadsheet metadata and cell values with an OAuth token", async () => {
    mockSpreadsheetsGet.mockResolvedValueOnce({
      data: {
        properties: { title: "LeadGeeks Employee Tracking 2026" },
        sheets: [
          { properties: { sheetId: 0, title: "Overview" } },
          { properties: { sheetId: 1976323691, title: "Wahid" } },
          { properties: { sheetId: 1976323692, title: "Team" } },
        ],
      },
    });

    mockValuesGet.mockResolvedValueOnce({
      data: {
        values: [
          ["Date", "Clock In", "Clock Out", "Website Management", "Cyber Security"],
          ["2026-09-01", "08:00", "17:00", "4:00", "4:00"],
          ["2026-09-02", "08:15", "17:15", "5:00", "3:00"],
        ],
      },
    });

    const result = await testReadSpreadsheet({
      accessToken: "mock_oauth_access_token",
      spreadsheetId: "1Rup5jNnSu-oTcOlZC3zIN7MNfzHqcP_rNrhnLIsX89Y",
      worksheetName: "Wahid",
      sheetGid: "1976323691",
    });

    expect(result.ok).toBe(true);
    expect(result.authMethod).toBe("oauth_user");
    expect(result.spreadsheetTitle).toBe("LeadGeeks Employee Tracking 2026");
    expect(result.targetSheetFound).toBe(true);
    expect(result.targetSheetName).toBe("Wahid");
    expect(result.targetSheetGid).toBe("1976323691");
    expect(result.sheets).toHaveLength(3);
    expect(result.rowCount).toBe(3);
    expect(result.columnCount).toBe(5);
    expect(result.sampleRange).toBe("'Wahid'!A1:Z15");
    expect(result.sampleValues?.[0][0]).toBe("Date");
    expect(result.sampleValues?.[1][0]).toBe("2026-09-01");
  });

  it("matches target sheet by GID fallback if tab title was renamed", async () => {
    mockSpreadsheetsGet.mockResolvedValueOnce({
      data: {
        properties: { title: "LeadGeeks Employee Tracking 2026" },
        sheets: [
          { properties: { sheetId: 1976323691, title: "Wahid Noor" } }, // renamed
        ],
      },
    });

    mockValuesGet.mockResolvedValueOnce({
      data: {
        values: [["Date", "Clock In"], ["2026-09-01", "08:00"]],
      },
    });

    const result = await testReadSpreadsheet({
      accessToken: "mock_oauth_access_token",
      spreadsheetId: "1Rup5jNnSu-oTcOlZC3zIN7MNfzHqcP_rNrhnLIsX89Y",
      worksheetName: "Wahid",
      sheetGid: "1976323691",
    });

    expect(result.ok).toBe(true);
    expect(result.targetSheetFound).toBe(true);
    expect(result.targetSheetName).toBe("Wahid Noor");
    expect(result.targetSheetGid).toBe("1976323691");
  });

  it("reports descriptive error when target worksheet tab is not found", async () => {
    mockSpreadsheetsGet.mockResolvedValueOnce({
      data: {
        properties: { title: "Company Sheet" },
        sheets: [
          { properties: { sheetId: 1, title: "Sheet1" } },
          { properties: { sheetId: 2, title: "Summary" } },
        ],
      },
    });

    const result = await testReadSpreadsheet({
      accessToken: "mock_oauth_access_token",
      spreadsheetId: "1Rup5jNnSu-oTcOlZC3zIN7MNfzHqcP_rNrhnLIsX89Y",
      worksheetName: "Wahid",
      sheetGid: "1976323691",
    });

    expect(result.ok).toBe(false);
    expect(result.targetSheetFound).toBe(false);
    expect(result.error).toContain('Worksheet tab "Wahid" not found in spreadsheet "Company Sheet"');
    expect(result.error).toContain('Available tabs: "Sheet1", "Summary"');
  });

  it("captures and surfaces Google API permission denied (403) errors cleanly", async () => {
    mockSpreadsheetsGet.mockRejectedValueOnce(
      new Error("The caller does not have permission to access spreadsheet 1Rup5jNnSu..."),
    );

    const result = await testReadSpreadsheet({
      accessToken: "invalid_or_unauthorized_token",
      spreadsheetId: "1Rup5jNnSu-oTcOlZC3zIN7MNfzHqcP_rNrhnLIsX89Y",
      worksheetName: "Wahid",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("The caller does not have permission");
  });
});
