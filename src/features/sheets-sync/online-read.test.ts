import { describe, expect, it, vi, beforeEach } from "vitest";
import { testReadSpreadsheet } from "./google";

// Mock database
const mockLimit = vi.fn().mockReturnValue([]);
const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock("@/server/db", () => ({
  db: {
    select: () => mockSelect(),
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
const mockRefreshAccessToken = vi.fn().mockResolvedValue({
  credentials: {
    access_token: "refreshed_token",
    expiry_date: Date.now() + 3600_000,
  },
});

vi.mock("googleapis", () => {
  return {
    google: {
      auth: {
        OAuth2: vi.fn().mockImplementation(() => ({
          setCredentials: vi.fn(),
          on: vi.fn(),
          refreshAccessToken: mockRefreshAccessToken,
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
    mockLimit.mockReturnValue([]);
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  });

  it("fails gracefully when no Google credentials (OAuth or Service Account) are available", async () => {
    const result = await testReadSpreadsheet({
      spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      worksheetName: "Employee1",
      sheetGid: "12345678",
    });

    expect(result.ok).toBe(false);
    expect(result.authMethod).toBe("none");
    expect(result.error).toContain("No Google credentials available");
  });

  it("reads online spreadsheet metadata and cell values with an OAuth token", async () => {
    mockSpreadsheetsGet.mockResolvedValueOnce({
      data: {
        properties: { title: "Company Employee Tracking 2026" },
        sheets: [
          { properties: { sheetId: 0, title: "Overview" } },
          { properties: { sheetId: 12345678, title: "Employee1" } },
          { properties: { sheetId: 12345679, title: "Team" } },
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
      spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      worksheetName: "Employee1",
      sheetGid: "12345678",
    });

    expect(result.ok).toBe(true);
    expect(result.authMethod).toBe("oauth_user");
    expect(result.spreadsheetTitle).toBe("Company Employee Tracking 2026");
    expect(result.targetSheetFound).toBe(true);
    expect(result.targetSheetName).toBe("Employee1");
    expect(result.targetSheetGid).toBe("12345678");
    expect(result.sheets).toHaveLength(3);
    expect(result.rowCount).toBe(3);
    expect(result.columnCount).toBe(5);
    expect(result.sampleRange).toBe("'Employee1'!A1:Z15");
    expect(result.sampleValues?.[0][0]).toBe("Date");
    expect(result.sampleValues?.[1][0]).toBe("2026-09-01");
  });

  it("matches target sheet by GID fallback if tab title was renamed", async () => {
    mockSpreadsheetsGet.mockResolvedValueOnce({
      data: {
        properties: { title: "Company Employee Tracking 2026" },
        sheets: [
          { properties: { sheetId: 12345678, title: "Team Sheet" } }, // renamed
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
      spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      worksheetName: "Employee1",
      sheetGid: "12345678",
    });

    expect(result.ok).toBe(true);
    expect(result.targetSheetFound).toBe(true);
    expect(result.targetSheetName).toBe("Team Sheet");
    expect(result.targetSheetGid).toBe("12345678");
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
      spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      worksheetName: "Employee1",
      sheetGid: "12345678",
    });

    expect(result.ok).toBe(false);
    expect(result.targetSheetFound).toBe(false);
    expect(result.error).toContain('Worksheet tab "Employee1" not found in spreadsheet "Company Sheet"');
    expect(result.error).toContain('Available tabs: "Sheet1", "Summary"');
  });

  it("captures and surfaces Google API permission denied (403) errors cleanly", async () => {
    mockSpreadsheetsGet.mockRejectedValueOnce(
      new Error("The caller does not have permission to access spreadsheet 1BxiMVs0X..."),
    );

    const result = await testReadSpreadsheet({
      accessToken: "invalid_or_unauthorized_token",
      spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      worksheetName: "Employee1",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("The caller does not have permission");
  });

  it("proactively refreshes expired OAuth token when userId is provided and has a refresh token", async () => {
    // User in DB has expired access token but valid refresh token
    mockLimit.mockReturnValue([
      {
        id: "user-123",
        googleAccessToken: "expired_token",
        googleRefreshToken: "valid_refresh_token",
        googleTokenExpiresAt: new Date(Date.now() - 3600_000), // 1 hour ago
      },
    ]);

    mockSpreadsheetsGet.mockResolvedValueOnce({
      data: {
        properties: { title: "Company Employee Tracking 2026" },
        sheets: [{ properties: { sheetId: 12345678, title: "Employee1" } }],
      },
    });

    mockValuesGet.mockResolvedValueOnce({
      data: {
        values: [["Date", "Clock In"], ["2026-09-01", "08:00"]],
      },
    });

    const result = await testReadSpreadsheet({
      userId: "user-123",
      spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      worksheetName: "Employee1",
      sheetGid: "12345678",
    });

    expect(result.ok).toBe(true);
    expect(result.authMethod).toBe("oauth_user");
    expect(mockRefreshAccessToken).toHaveBeenCalled();
  });

  it("formats invalid or expired OAuth credential errors into a user-friendly message", async () => {
    mockSpreadsheetsGet.mockRejectedValueOnce(
      new Error(
        "Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential.",
      ),
    );

    const result = await testReadSpreadsheet({
      accessToken: "expired_token_without_refresh",
      spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      worksheetName: "Employee1",
    });

    expect(result.ok).toBe(false);
    expect(result.authExpired).toBe(true);
    expect(result.error).toContain("Google OAuth access expired or invalid");
  });
});
