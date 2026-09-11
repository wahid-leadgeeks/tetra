import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { updateAttendanceTimes } from "@/features/attendance/service";
import { setReviewed } from "@/features/daily-summary/service";
import { getSheetsClient } from "@/features/sheets-sync/google";
import { executeSync, getSyncConfig } from "@/features/sheets-sync/service";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { dailyAttendance } from "@/server/db/schema";

const dateParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Invalid date");

const sessionUserSchema = z.object({
  id: z.string().min(1),
  timezone: z.string().min(1),
});

const bodySchema = z.object({
  action: z.enum(["clock_in", "clock_out", "update"]).optional(),
  clockInAt: z.string().optional().nullable(),
  clockOutAt: z.string().optional().nullable(),
  status: z.enum(["open", "closed"]).optional(),
});

/**
 * POST /api/days/[date]/attendance
 * Updates or sets attendance times (clock-in, clock-out, status) for a specific day.
 * Auto-syncs to Google Sheets if autoSyncOnClockOut is configured.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  const parsedDate = dateParamSchema.safeParse(date);
  if (!parsedDate.success) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const session = await auth();
  const parsedUser = sessionUserSchema.safeParse(session?.user);
  if (!parsedUser.success) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json().catch(() => ({}));
  const parsedBody = bodySchema.safeParse(raw);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid body parameters" },
      { status: 400 },
    );
  }

  const { id: userId, timezone } = parsedUser.data;
  const workDate = parsedDate.data;

  try {
    const attendance = await updateAttendanceTimes(
      userId,
      workDate,
      timezone,
      parsedBody.data,
    );

    // Auto-sync if closing attendance and autoSyncOnClockOut is enabled
    let autoSyncResult: {
      attempted: boolean;
      success?: boolean;
      idempotent?: boolean;
      changedCount?: number;
      message?: string;
    } = { attempted: false };

    if (attendance.status === "closed") {
      const config = await getSyncConfig(userId);
      if (config && config.mapping.autoSyncOnClockOut === true) {
        const sheets = await getSheetsClient({
          userId,
          accessToken: session?.accessToken,
        });

        if (sheets) {
          try {
            // Mark reviewed then execute sync
            await setReviewed(userId, workDate, timezone);
            const syncRes = await executeSync(userId, workDate, {
              accessToken: session?.accessToken,
            });
            autoSyncResult = {
              attempted: true,
              success: true,
              idempotent: syncRes.idempotent,
              changedCount: syncRes.changedCells.length,
            };
          } catch (syncErr) {
            console.error("Auto-sync on attendance update failed:", syncErr);
            await db
              .update(dailyAttendance)
              .set({
                reviewState: "ready",
                reviewedAt: null,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(dailyAttendance.userId, userId),
                  eq(dailyAttendance.workDate, workDate),
                ),
              );
            autoSyncResult = {
              attempted: true,
              success: false,
              message:
                syncErr instanceof Error ? syncErr.message : "Auto-sync failed",
            };
          }
        }
      }
    }

    return NextResponse.json({
      attendance,
      autoSync: autoSyncResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update attendance";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
