/**
 * Sheets Sync error taxonomy. Route handlers map these to HTTP statuses:
 * SyncNotConfiguredError → 400, SheetsApiError → 502.
 */

/** No spreadsheet configured, or Google credentials are missing (HTTP 400). */
export class SyncNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncNotConfiguredError";
  }
}

/** A Google Sheets API call failed (HTTP 502, day stays 'reviewed'). */
export class SheetsApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetsApiError";
  }
}
