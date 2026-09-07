/**
 * Pull Day From Sheet — imports a single day's tracking row from Google Sheets
 * into TETRA's database (attendance, breaks, and time entries).
 * Pure allocation logic separates Google cell reading from DB persistence.
 */
import { and, eq, gte, lte } from "drizzle-orm";
import type { sheets_v4 } from "googleapis";
import { getDaySummary } from "@/features/daily-summary/service";
import type { DaySummaryDTO } from "@/lib/types";
import { zonedDayEnd, zonedDayStart } from "@/lib/time";
import { db } from "@/server/db";
import {
  breakEntries,
  categories,
  dailyAttendance,
  tasks,
  timeEntries,
} from "@/server/db/schema";
import {
  CATEGORY_KEYS,
  type CategoryKey,
} from "./mapping";
import { SyncNotConfiguredError } from "./errors";
import {
  getSyncConfig,
  getUserTimezone,
  type SpreadsheetConfigDTO,
} from "./config";
import { getSheetsClient, worksheetRange } from "./google";
import { findDateRow } from "./rows";

/** Maximum rows to scan for the target date. */
const DATE_SCAN_MAX_ROWS = 2000;

export interface RawCategoryItem {
  categoryKey: CategoryKey;
  durationMinutes: number;
  notes: string;
}

export interface AllocatedEntry {
  categoryKey: CategoryKey;
  taskName: string;
  notes: string;
  startMinutes: number;
  endMinutes: number;
}

/**
 * Parses time string or decimal to minutes from midnight.
 * Handles "8:20", "08:20", "8:20 AM", "2:30 PM", "14:30", and numeric day fractions.
 */
export function parseClockMinutes(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    if (val >= 0 && val < 1) {
      return Math.round(val * 24 * 60);
    }
    return null;
  }
  const str = String(val).trim();
  if (!str || str === "-" || str === "0") return null;

  const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  const num = Number(str);
  if (!isNaN(num) && num >= 0 && num < 1) {
    return Math.round(num * 24 * 60);
  }

  return null;
}

/**
 * Parses duration to total minutes.
 * Handles "1h 45m", "1h", "45m", "1 hr 45 min", "1:45", and numeric values.
 */
export function parseDurationMinutes(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") {
    if (val > 0 && val < 1) {
      return Math.round(val * 24 * 60);
    }
    if (val >= 1) {
      return Math.round(val * 60);
    }
    return 0;
  }
  const str = String(val).trim();
  if (!str || str === "-" || str === "0") return 0;

  // "1h 45m" or "45m" or "1h"
  const hMatch = str.match(/(\d+)\s*(?:h|hr|hour)s?/i);
  const mMatch = str.match(/(\d+)\s*(?:m|min|minute)s?/i);
  if (hMatch || mMatch) {
    const h = hMatch ? parseInt(hMatch[1], 10) : 0;
    const m = mMatch ? parseInt(mMatch[1], 10) : 0;
    return h * 60 + m;
  }

  // "1:45"
  const colonMatch = str.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
  }

  const num = parseFloat(str);
  if (!isNaN(num) && num > 0) {
    if (str.includes(".") && str.length > 5 && num < 1) {
      return Math.round(num * 24 * 60);
    }
    return Math.round(num * 60);
  }

  return 0;
}

/**
 * Pure function to lay out category tasks along the timeline, cleanly respecting
 * breaks and allocating duration across note lines.
 */
export function allocateTimelineEntries(params: {
  categoryItems: RawCategoryItem[];
  clockInMinutes: number;
  breakStartMinutes: number | null;
  breakEndMinutes: number | null;
  defaultCategoryNames: Record<CategoryKey, string>;
}): AllocatedEntry[] {
  const {
    categoryItems,
    clockInMinutes,
    breakStartMinutes,
    breakEndMinutes,
    defaultCategoryNames,
  } = params;

  const hasBreak =
    breakStartMinutes !== null &&
    breakEndMinutes !== null &&
    breakEndMinutes > breakStartMinutes;

  const entries: AllocatedEntry[] = [];
  let cursor = clockInMinutes;

  for (const item of categoryItems) {
    if (item.durationMinutes <= 0) continue;

    const lines = item.notes
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const defaultName = defaultCategoryNames[item.categoryKey] || item.categoryKey;
    const taskCount = Math.max(1, lines.length);
    const baseDuration = Math.floor(item.durationMinutes / taskCount);
    const remainder = item.durationMinutes % taskCount;

    for (let i = 0; i < taskCount; i++) {
      let duration = baseDuration + (i === 0 ? remainder : 0);
      const name = lines[i] || defaultName;
      const notes = lines[i] || defaultName;

      while (duration > 0) {
        // If cursor has reached break start, skip ahead to break end
        if (hasBreak && cursor >= breakStartMinutes && cursor < breakEndMinutes) {
          cursor = breakEndMinutes;
        }

        if (hasBreak && cursor < breakStartMinutes && cursor + duration > breakStartMinutes) {
          // Entry overlaps break boundary: split into before and after break
          const partDuration = breakStartMinutes - cursor;
          entries.push({
            categoryKey: item.categoryKey,
            taskName: name,
            notes,
            startMinutes: cursor,
            endMinutes: breakStartMinutes,
          });
          cursor = breakEndMinutes;
          duration -= partDuration;
        } else {
          // Fits fully before or after break
          const start = cursor;
          const end = cursor + duration;
          entries.push({
            categoryKey: item.categoryKey,
            taskName: name,
            notes,
            startMinutes: start,
            endMinutes: end,
          });
          cursor = end;
          duration = 0;
        }
      }
    }
  }

  return entries;
}

/**
 * Reads the date column to scan rows.
 */
async function readDateColumn(
  sheets: sheets_v4.Sheets,
  config: SpreadsheetConfigDTO,
): Promise<string[][]> {
  const dateColumn = config.mapping.dateColumn;
  const range = worksheetRange(
    config.worksheetName,
    `${dateColumn}1:${dateColumn}${DATE_SCAN_MAX_ROWS}`,
  );
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range,
  });
  return res.data.values ?? [];
}

/**
 * Pull a day's tracking row from Google Sheets and populate TETRA's database.
 * Returns the refreshed DaySummaryDTO.
 */
export async function pullDayFromSheet(
  userId: string,
  dayKey: string,
  options?: { accessToken?: string },
): Promise<DaySummaryDTO> {
  const config = await getSyncConfig(userId);
  if (!config) throw new SyncNotConfiguredError("No spreadsheet configured");

  const sheets = await getSheetsClient({
    userId,
    accessToken: options?.accessToken,
  });
  if (!sheets) {
    throw new SyncNotConfiguredError("Google Sheets credentials not configured");
  }

  const timezone = await getUserTimezone(userId);

  // 1. Locate the row
  const dateRows = await readDateColumn(sheets, config);
  const rowNumber = findDateRow(dateRows, config.mapping, dayKey);
  if (rowNumber === null) {
    throw new Error(`Date ${dayKey} was not found in spreadsheet worksheet "${config.worksheetName}"`);
  }

  // 2. Fetch cell values for attendance & categories
  const cellRequests: { key: string; a1: string }[] = [
    { key: "clockIn", a1: `${config.mapping.clockInColumn}${rowNumber}` },
    { key: "breakStart", a1: `${config.mapping.breakStartColumn}${rowNumber}` },
    { key: "breakEnd", a1: `${config.mapping.breakEndColumn}${rowNumber}` },
    { key: "clockOut", a1: `${config.mapping.clockOutColumn}${rowNumber}` },
  ];

  for (const catKey of CATEGORY_KEYS) {
    const durCol = config.mapping.categories[catKey];
    if (durCol) {
      cellRequests.push({ key: `cat_${catKey}`, a1: `${durCol}${rowNumber}` });
    }
    const noteCol = config.mapping.categoryNotes?.[catKey];
    if (noteCol) {
      cellRequests.push({ key: `note_${catKey}`, a1: `${noteCol}${rowNumber}` });
    }
  }

  const batchRes = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: config.spreadsheetId,
    ranges: cellRequests.map((c) => worksheetRange(config.worksheetName, c.a1)),
    valueRenderOption: "FORMATTED_VALUE",
  });

  const valueRanges = batchRes.data.valueRanges ?? [];
  const rawValues: Record<string, string> = {};
  cellRequests.forEach((req, idx) => {
    const val = valueRanges[idx]?.values?.[0]?.[0];
    rawValues[req.key] = val !== undefined && val !== null ? String(val).trim() : "";
  });

  // 3. Parse times
  const clockInMinutes = parseClockMinutes(rawValues.clockIn) ?? 8 * 60 + 30; // default 08:30 if empty
  const breakStartMinutes = parseClockMinutes(rawValues.breakStart);
  const breakEndMinutes = parseClockMinutes(rawValues.breakEnd);
  let clockOutMinutes = parseClockMinutes(rawValues.clockOut);

  // 4. Parse categories
  const categoryItems: RawCategoryItem[] = [];
  for (const catKey of CATEGORY_KEYS) {
    const durStr = rawValues[`cat_${catKey}`];
    const durationMinutes = parseDurationMinutes(durStr);
    const notes = rawValues[`note_${catKey}`] || "";
    if (durationMinutes > 0) {
      categoryItems.push({
        categoryKey: catKey,
        durationMinutes,
        notes,
      });
    }
  }

  if (categoryItems.length === 0 && !rawValues.clockIn && !rawValues.clockOut) {
    throw new Error(`Row for ${dayKey} contains no tracking data in the spreadsheet.`);
  }

  // Fetch categories from DB
  const dbCategories = await db.select().from(categories);
  const categoryByKey = new Map(dbCategories.map((c) => [c.key as CategoryKey, c]));
  const defaultNames: Record<CategoryKey, string> = {} as Record<CategoryKey, string>;
  for (const cat of dbCategories) {
    defaultNames[cat.key as CategoryKey] = cat.name;
  }

  // Allocate timeline items
  const allocated = allocateTimelineEntries({
    categoryItems,
    clockInMinutes,
    breakStartMinutes,
    breakEndMinutes,
    defaultCategoryNames: defaultNames,
  });

  // Ensure clockOut is at least after the last entry
  const latestEndMinutes = allocated.reduce(
    (max, e) => Math.max(max, e.endMinutes),
    clockInMinutes,
  );
  if (clockOutMinutes === null || clockOutMinutes < latestEndMinutes) {
    clockOutMinutes = latestEndMinutes;
  }

  // 5. Update Database
  const dayStartUtc = zonedDayStart(dayKey, timezone);
  const dayEndUtc = zonedDayEnd(dayKey, timezone);
  const toUtcDate = (mins: number) => new Date(dayStartUtc.getTime() + mins * 60_000);

  const clockInAt = toUtcDate(clockInMinutes);
  const clockOutAt = toUtcDate(clockOutMinutes);

  // Upsert daily attendance
  const existingAttendance = (
    await db
      .select()
      .from(dailyAttendance)
      .where(
        and(
          eq(dailyAttendance.userId, userId),
          eq(dailyAttendance.workDate, dayKey),
        ),
      )
      .limit(1)
  )[0];

  let attendanceId: string;
  const now = new Date();

  if (existingAttendance) {
    attendanceId = existingAttendance.id;
    // Clear previous breaks and entries for this day
    await db.delete(breakEntries).where(eq(breakEntries.attendanceId, attendanceId));
    await db
      .delete(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, userId),
          gte(timeEntries.startedAt, dayStartUtc),
          lte(timeEntries.startedAt, dayEndUtc),
        ),
      );

    await db
      .update(dailyAttendance)
      .set({
        clockInAt,
        clockOutAt,
        status: "closed",
        reviewState: "reviewed",
        reviewedAt: now,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(dailyAttendance.id, attendanceId));
  } else {
    const [created] = await db
      .insert(dailyAttendance)
      .values({
        userId,
        workDate: dayKey,
        clockInAt,
        clockOutAt,
        status: "closed",
        reviewState: "reviewed",
        reviewedAt: now,
        lastSyncedAt: now,
      })
      .returning();
    attendanceId = created.id;
  }

  // Insert breaks
  if (
    breakStartMinutes !== null &&
    breakEndMinutes !== null &&
    breakEndMinutes > breakStartMinutes
  ) {
    await db.insert(breakEntries).values({
      userId,
      attendanceId,
      startedAt: toUtcDate(breakStartMinutes),
      endedAt: toUtcDate(breakEndMinutes),
    });
  }

  // Insert tasks and entries
  for (const item of allocated) {
    const cat = categoryByKey.get(item.categoryKey);
    if (!cat) continue;

    // Find or create task
    let task = (
      await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.name, item.taskName)))
        .limit(1)
    )[0];

    const entryStartedAt = toUtcDate(item.startMinutes);
    const entryEndedAt = toUtcDate(item.endMinutes);

    if (!task) {
      const [createdTask] = await db
        .insert(tasks)
        .values({
          userId,
          name: item.taskName,
          categoryId: cat.id,
          lastUsedAt: entryEndedAt,
        })
        .returning();
      task = createdTask;
    } else {
      await db
        .update(tasks)
        .set({ lastUsedAt: entryEndedAt })
        .where(eq(tasks.id, task.id));
    }

    await db.insert(timeEntries).values({
      userId,
      taskId: task.id,
      categoryId: cat.id,
      startedAt: entryStartedAt,
      endedAt: entryEndedAt,
      status: "completed",
      notes: item.notes,
      source: "manual",
    });
  }

  return getDaySummary(userId, dayKey, timezone);
}
