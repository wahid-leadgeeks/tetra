import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { executeFileSync } from "@/features/sheets-sync/file-sync";
import { SyncNotConfiguredError } from "@/features/sheets-sync/service";
import { auth } from "@/server/auth";

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST multipart/form-data: "file" = .xlsx or .csv, "date" = YYYY-MM-DD.
 * Returns the updated file as a download (same name, edited cells).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return jsonError(401, "Unauthorized");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "Expected a multipart form upload");
  }

  const date = String(form.get("date") ?? "");
  if (!DAY_KEY_PATTERN.test(date)) {
    return jsonError(400, "Invalid date, expected YYYY-MM-DD");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, "No file uploaded");
  }
  if (file.size === 0) return jsonError(400, "The uploaded file is empty");
  if (file.size > MAX_FILE_BYTES) {
    return jsonError(400, "File is larger than 5 MB");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const result = await executeFileSync(userId, date, {
      fileName: file.name,
      buffer,
    });
    const body = new Uint8Array(result.buffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${downloadName(result.fileName)}"`,
        "X-Sync-Status": result.status,
        "X-Sync-Idempotent": result.idempotent ? "true" : "false",
        "X-Sync-Changed-Cells": String(result.changedCells.length),
      },
    });
  } catch (err) {
    if (err instanceof SyncNotConfiguredError) {
      return jsonError(400, err.message);
    }
    if (err instanceof Error) return jsonError(400, err.message);
    return jsonError(400, "File sync failed");
  }
}

/** Safe download filename: strip path separators and quotes. */
function downloadName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "report";
  return base.replace(/["\r\n]/g, "_");
}
