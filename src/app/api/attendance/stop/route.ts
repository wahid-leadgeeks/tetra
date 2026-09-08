import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { clockOut } from "@/features/attendance/service";
import { setReviewed } from "@/features/daily-summary/service";
import { getSheetsClient } from "@/features/sheets-sync/google";
import { executeSync, getSyncConfig } from "@/features/sheets-sync/service";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { dailyAttendance } from "@/server/db/schema";

const EmptyBody = z.object({});

/** POST /api/attendance/stop — clock out the open attendance & auto-sync if configured. */
export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId, timezone } = session.user;
  try {
    const raw = await req.json().catch(() => null);
    EmptyBody.parse(raw ?? {});

    const attendance = await clockOut(userId, timezone);

    // Check if user has active sheet sync config with autoSyncOnClockOut
    const config = await getSyncConfig(userId);
    let autoSyncResult: {
      attempted: boolean;
      success?: boolean;
      idempotent?: boolean;
      changedCount?: number;
      message?: string;
    } = { attempted: false };

    if (config && config.mapping.autoSyncOnClockOut === true) {
      const sheets = await getSheetsClient({
        userId,
        accessToken: session.accessToken,
      });

      if (!sheets) {
        autoSyncResult = {
          attempted: true,
          success: false,
          message: "Google Sheets credentials not configured",
        };
      } else {
        try {
          // 1. Mark day reviewed so executeSync can run
          await setReviewed(userId, attendance.workDate, timezone);

          // 2. Execute sync to Google Sheets
          const syncRes = await executeSync(userId, attendance.workDate, {
            accessToken: session.accessToken,
          });

          autoSyncResult = {
            attempted: true,
            success: true,
            idempotent: syncRes.idempotent,
            changedCount: syncRes.changedCells.length,
          };
        } catch (syncErr) {
          console.error("Auto-sync on clock-out failed:", syncErr);
          await db
            .update(dailyAttendance)
            .set({ reviewState: "draft", reviewedAt: null, updatedAt: new Date() })
            .where(
              and(
                eq(dailyAttendance.userId, userId),
                eq(dailyAttendance.workDate, attendance.workDate),
              ),
            );
          autoSyncResult = {
            attempted: true,
            success: false,
            message: syncErr instanceof Error ? syncErr.message : "Auto-sync failed",
          };
        }
      }
    }

    return NextResponse.json({
      ...attendance,
      autoSync: autoSyncResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
