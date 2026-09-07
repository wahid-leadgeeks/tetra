import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSyncConfig } from "@/features/sheets-sync/config";
import { testReadSpreadsheet } from "@/features/sheets-sync/google";
import { auth } from "@/server/auth";
import { env } from "@/server/env";

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function resolveParams(
  userId: string,
  input?: {
    spreadsheetId?: string;
    worksheetName?: string;
    sheetGid?: string | null;
  },
) {
  const config = await getSyncConfig(userId);

  const spreadsheetId =
    input?.spreadsheetId?.trim() ||
    config?.spreadsheetId ||
    env.GOOGLE_SPREADSHEET_ID ||
    "";

  const worksheetName =
    input?.worksheetName?.trim() ||
    config?.worksheetName ||
    env.GOOGLE_SHEET_NAME ||
    "Sheet1";

  const sheetGid =
    input?.sheetGid !== undefined
      ? input.sheetGid
      : (config?.sheetGid ?? env.GOOGLE_SHEET_GID ?? null);

  return { spreadsheetId, worksheetName, sheetGid };
}

/**
 * GET /api/sheets/inspect?spreadsheetId=...&worksheetName=...&sheetGid=...
 * Inspects the online Google Spreadsheet and reads sample rows.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, "Unauthorized");
  }

  const { searchParams } = new URL(req.url);
  const qSpreadsheetId = searchParams.get("spreadsheetId") || undefined;
  const qWorksheetName = searchParams.get("worksheetName") || undefined;
  const qSheetGid = searchParams.get("sheetGid") || undefined;

  const { spreadsheetId, worksheetName, sheetGid } = await resolveParams(
    session.user.id,
    {
      spreadsheetId: qSpreadsheetId,
      worksheetName: qWorksheetName,
      sheetGid: qSheetGid,
    },
  );

  if (!spreadsheetId || spreadsheetId === "file") {
    return jsonError(
      400,
      "No Google Spreadsheet ID provided or configured. Please enter a valid Spreadsheet ID.",
    );
  }

  const result = await testReadSpreadsheet({
    userId: session.user.id,
    accessToken: session.accessToken,
    spreadsheetId,
    worksheetName,
    sheetGid,
  });

  return NextResponse.json(result);
}

/**
 * POST /api/sheets/inspect
 * Body: { spreadsheetId?: string, worksheetName?: string, sheetGid?: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, "Unauthorized");
  }

  let body: {
    spreadsheetId?: string;
    worksheetName?: string;
    sheetGid?: string | null;
  } = {};

  try {
    body = await req.json();
  } catch {
    // Body is optional; fallback to query or stored config
  }

  const { spreadsheetId, worksheetName, sheetGid } = await resolveParams(
    session.user.id,
    body,
  );

  if (!spreadsheetId || spreadsheetId === "file") {
    return jsonError(
      400,
      "No Google Spreadsheet ID provided or configured. Please enter a valid Spreadsheet ID.",
    );
  }

  const result = await testReadSpreadsheet({
    userId: session.user.id,
    accessToken: session.accessToken,
    spreadsheetId,
    worksheetName,
    sheetGid,
  });

  return NextResponse.json(result);
}
