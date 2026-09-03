/**
 * Google Sheets client construction — the ONLY place googleapis is imported.
 * MVP auth: service-account JWT from env vars; null when unconfigured.
 */
import { google, type sheets_v4 } from "googleapis";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/** Memoized client — one JWT per process. */
let cachedSheetsClient: sheets_v4.Sheets | null = null;

/**
 * Service-account JWT client from GOOGLE_SERVICE_ACCOUNT_EMAIL /
 * GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY. Returns null when the vars are absent —
 * every Google call is guarded behind that null (callers throw
 * SyncNotConfiguredError, the day stays 'reviewed' and retry stays possible).
 */
export function getSheetsClient(): sheets_v4.Sheets | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) return null;
  if (!cachedSheetsClient) {
    // Env-pasted keys carry literal "\n"; normalize at the boundary.
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
