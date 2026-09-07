/**
 * Google Sheets client construction — the ONLY place googleapis is imported.
 * Auth options:
 *   1. User OAuth token (from NextAuth session or database)
 *   2. Service-account JWT from env vars (GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY)
 *   3. Null when unconfigured.
 * googleapis is loaded lazily so routes compile fast and unconfigured
 * environments never pay the import cost.
 */
import { eq } from "drizzle-orm";
import type { sheets_v4 } from "googleapis";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { env } from "@/server/env";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/** Memoized service-account client — one JWT per process. */
let cachedSheetsClient: sheets_v4.Sheets | null = null;

export interface GetSheetsClientOptions {
  userId?: string;
  accessToken?: string;
}

/**
 * Returns an authenticated Google Sheets client.
 * Priority:
 * 1. Explicit accessToken
 * 2. User OAuth tokens in database (refreshed automatically if expired)
 * 3. Service Account credentials in environment variables
 */
export async function getSheetsClient(
  options?: GetSheetsClientOptions,
): Promise<sheets_v4.Sheets | null> {
  const { google } = await import("googleapis");

  // 1. Explicit access token
  if (options?.accessToken) {
    const oauth2 = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID || undefined,
      env.GOOGLE_CLIENT_SECRET || undefined,
    );
    oauth2.setCredentials({ access_token: options.accessToken });
    return google.sheets({ version: "v4", auth: oauth2 });
  }

  // 2. User OAuth credentials from DB
  if (options?.userId) {
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, options.userId))
      .limit(1);

    const user = userRows[0];
    if (user?.googleAccessToken) {
      const oauth2 = new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID || undefined,
        env.GOOGLE_CLIENT_SECRET || undefined,
      );

      oauth2.setCredentials({
        access_token: user.googleAccessToken,
        refresh_token: user.googleRefreshToken ?? undefined,
      });

      // Refresh if expired or expiring within 60 seconds
      const isExpired =
        user.googleTokenExpiresAt &&
        user.googleTokenExpiresAt.getTime() < Date.now() + 60_000;

      if (
        isExpired &&
        user.googleRefreshToken &&
        env.GOOGLE_CLIENT_ID &&
        env.GOOGLE_CLIENT_SECRET
      ) {
        try {
          const { credentials } = await oauth2.refreshAccessToken();
          if (credentials.access_token) {
            await db
              .update(users)
              .set({
                googleAccessToken: credentials.access_token,
                googleTokenExpiresAt: credentials.expiry_date
                  ? new Date(credentials.expiry_date)
                  : null,
              })
              .where(eq(users.id, user.id));
          }
        } catch {
          // If refresh fails, continue with existing credentials
        }
      }

      return google.sheets({ version: "v4", auth: oauth2 });
    }
  }

  // 3. Service Account JWT fallback
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) return null;

  if (!cachedSheetsClient) {
    const normalizedKey = key.replaceAll("\\n", "\n");
    const jwt = new google.auth.JWT({
      email,
      key: normalizedKey,
      scopes: [SHEETS_SCOPE],
    });
    cachedSheetsClient = google.sheets({ version: "v4", auth: jwt });
  }
  return cachedSheetsClient;
}

/** `'My Sheet'!A1` — always quoted, internal quotes doubled. */
export function worksheetRange(
  worksheetName: string,
  cellSuffix: string,
): string {
  const quoted = `'${worksheetName.replaceAll("'", "''")}'`;
  return `${quoted}!${cellSuffix}`;
}

export interface TestReadSpreadsheetResult {
  ok: boolean;
  spreadsheetId: string;
  spreadsheetTitle?: string;
  sheets: Array<{ id: number; title: string }>;
  targetSheetName: string;
  targetSheetGid?: string | null;
  targetSheetFound: boolean;
  sampleRange?: string;
  sampleValues?: string[][];
  rowCount?: number;
  columnCount?: number;
  authMethod: "oauth_user" | "service_account" | "none";
  error?: string;
}

/**
 * Tests reading an online Google Spreadsheet:
 * 1. Checks permissions & fetches spreadsheet metadata (title, list of tabs)
 * 2. Confirms target worksheet tab exists
 * 3. Reads sample cell values from the worksheet
 */
export async function testReadSpreadsheet(options: {
  userId?: string;
  accessToken?: string;
  spreadsheetId: string;
  worksheetName: string;
  sheetGid?: string | null;
}): Promise<TestReadSpreadsheetResult> {
  const { spreadsheetId, worksheetName, sheetGid } = options;

  let authMethod: TestReadSpreadsheetResult["authMethod"] = "none";
  let client: sheets_v4.Sheets | null = null;

  if (options.accessToken) {
    authMethod = "oauth_user";
    client = await getSheetsClient({ accessToken: options.accessToken });
  } else if (options.userId) {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, options.userId))
      .limit(1);
    if (user[0]?.googleAccessToken) {
      authMethod = "oauth_user";
      client = await getSheetsClient({ userId: options.userId });
    }
  }

  if (!client) {
    if (
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    ) {
      authMethod = "service_account";
      client = await getSheetsClient();
    }
  }

  if (!client) {
    return {
      ok: false,
      spreadsheetId,
      targetSheetName: worksheetName,
      targetSheetGid: sheetGid ?? null,
      targetSheetFound: false,
      sheets: [],
      authMethod: "none",
      error:
        "No Google credentials available. Please sign in with Google or configure a Google Service Account in .env.local.",
    };
  }

  try {
    // 1. Fetch spreadsheet metadata
    const metaRes = await client.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
    });

    const spreadsheetTitle = metaRes.data.properties?.title ?? "Untitled";
    const sheetTabs =
      metaRes.data.sheets?.map((s) => ({
        id: s.properties?.sheetId ?? 0,
        title: s.properties?.title ?? "",
      })) ?? [];

    // 2. Locate target worksheet (by name or GID fallback)
    const normalizedTarget = worksheetName.trim().toLowerCase();
    const targetTab = sheetTabs.find(
      (s) =>
        s.title.toLowerCase() === normalizedTarget ||
        (sheetGid && String(s.id) === sheetGid.trim()),
    );

    const actualSheetName = targetTab ? targetTab.title : worksheetName;

    if (!targetTab) {
      return {
        ok: false,
        spreadsheetId,
        spreadsheetTitle,
        sheets: sheetTabs,
        targetSheetName: worksheetName,
        targetSheetGid: sheetGid ?? null,
        targetSheetFound: false,
        authMethod,
        error: `Worksheet tab "${worksheetName}" not found in spreadsheet "${spreadsheetTitle}". Available tabs: ${sheetTabs.map((s) => `"${s.title}"`).join(", ")}.`,
      };
    }

    // 3. Read sample rows from the sheet
    const sampleRange = worksheetRange(actualSheetName, "A1:Z15");
    const valRes = await client.spreadsheets.values.get({
      spreadsheetId,
      range: sampleRange,
    });

    const sampleValues = (valRes.data.values as string[][]) ?? [];

    return {
      ok: true,
      spreadsheetId,
      spreadsheetTitle,
      sheets: sheetTabs,
      targetSheetName: actualSheetName,
      targetSheetGid: String(targetTab.id),
      targetSheetFound: true,
      sampleRange,
      sampleValues,
      rowCount: sampleValues.length,
      columnCount: sampleValues[0]?.length ?? 0,
      authMethod,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      spreadsheetId,
      targetSheetName: worksheetName,
      targetSheetGid: sheetGid ?? null,
      targetSheetFound: false,
      sheets: [],
      authMethod,
      error: message,
    };
  }
}
