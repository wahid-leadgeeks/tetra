import { describe, expect, it } from "vitest";
import {
  SheetsApiError,
  SyncNotConfiguredError,
} from "@/features/sheets-sync/errors";
import { syncErrorResponse } from "./sync-error-response";

describe("syncErrorResponse", () => {
  it("maps SyncNotConfiguredError to 400 with code not_configured", async () => {
    const res = syncErrorResponse(new SyncNotConfiguredError("No spreadsheet configured"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "No spreadsheet configured",
      code: "not_configured",
    });
  });

  it("keeps generic errors as 400 without a code", async () => {
    const res = syncErrorResponse(new Error("Date row not found"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Date row not found" });
  });

  it("maps SheetsApiError to 502", async () => {
    const res = syncErrorResponse(new SheetsApiError("boom"));
    expect(res.status).toBe(502);
  });
});
