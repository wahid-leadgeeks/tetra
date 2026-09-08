import { and, eq } from "drizzle-orm";

import { getDaySummary } from "@/features/daily-summary/service";
import { zonedDayEnd, zonedDayStart } from "@/lib/time";
import { db } from "@/server/db";
import {
  calendarConfigs,
  categories,
  tasks,
  timeEntries,
  users,
} from "@/server/db/schema";
import { processCalendarEvent } from "./domain";
import { fetchCalendarEvents, listUserCalendars } from "./google";
import type {
  CalendarConfigDTO,
  CalendarEventSuggestionDTO,
  CalendarItemDTO,
  ImportCalendarEventsInputDTO,
  ImportCalendarEventsResultDTO,
} from "./types";

/**
 * Retrieves user's calendar configuration or default values.
 */
export async function getCalendarConfig(userId: string): Promise<CalendarConfigDTO> {
  const userRows = await db
    .select({
      id: users.id,
      googleAccessToken: users.googleAccessToken,
      googleRefreshToken: users.googleRefreshToken,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const hasGoogleAuth = !!(
    userRows[0]?.googleAccessToken || userRows[0]?.googleRefreshToken
  );

  let config = undefined;
  try {
    const configRows = await db
      .select()
      .from(calendarConfigs)
      .where(eq(calendarConfigs.userId, userId))
      .limit(1);
    config = configRows[0];
  } catch (err) {
    console.warn("Could not query calendarConfigs (migration may be pending):", err);
  }

  if (!config) {
    return {
      id: "",
      userId,
      calendarId: "primary",
      calendarName: "Primary",
      syncEnabled: false,
      categoryRules: null,
      lastSyncAt: null,
      hasGoogleAuth,
    };
  }

  return {
    id: config.id,
    userId: config.userId,
    calendarId: config.calendarId,
    calendarName: config.calendarName,
    syncEnabled: config.syncEnabled,
    categoryRules: config.categoryRules as CalendarConfigDTO["categoryRules"],
    lastSyncAt: config.lastSyncAt ? config.lastSyncAt.toISOString() : null,
    hasGoogleAuth,
  };
}

/**
 * Updates or creates calendar configuration for user.
 */
export async function updateCalendarConfig(
  userId: string,
  input: {
    calendarId?: string;
    calendarName?: string;
    syncEnabled?: boolean;
    categoryRules?: unknown;
  },
): Promise<CalendarConfigDTO> {
  const existing = await db
    .select()
    .from(calendarConfigs)
    .where(eq(calendarConfigs.userId, userId))
    .limit(1);

  const now = new Date();

  if (existing.length > 0) {
    await db
      .update(calendarConfigs)
      .set({
        ...(input.calendarId !== undefined ? { calendarId: input.calendarId } : {}),
        ...(input.calendarName !== undefined ? { calendarName: input.calendarName } : {}),
        ...(input.syncEnabled !== undefined ? { syncEnabled: input.syncEnabled } : {}),
        ...(input.categoryRules !== undefined ? { categoryRules: input.categoryRules } : {}),
        updatedAt: now,
      })
      .where(eq(calendarConfigs.id, existing[0].id));
  } else {
    await db.insert(calendarConfigs).values({
      userId,
      calendarId: input.calendarId ?? "primary",
      calendarName: input.calendarName ?? "Primary",
      syncEnabled: input.syncEnabled ?? true,
      categoryRules: input.categoryRules ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  return getCalendarConfig(userId);
}

/**
 * Lists available user calendars from Google Calendar API.
 */
export async function getAvailableCalendars(userId: string): Promise<CalendarItemDTO[]> {
  return listUserCalendars({ userId });
}

/**
 * Fetches Google Calendar events for a given local day and processes them with
 * category suggestions and overlap detection against existing time entries.
 */
export async function getCalendarSchedule(
  userId: string,
  dayKey: string,
  timeZone: string,
): Promise<{
  events: CalendarEventSuggestionDTO[];
  config: CalendarConfigDTO;
  hasGoogleAuth: boolean;
}> {
  const config = await getCalendarConfig(userId);

  if (!config.hasGoogleAuth || !config.syncEnabled) {
    return { events: [], config, hasGoogleAuth: config.hasGoogleAuth };
  }

  const timeMin = zonedDayStart(dayKey, timeZone);
  const timeMax = zonedDayEnd(dayKey, timeZone);

  try {
    // Fetch raw calendar events
    const rawEvents = await fetchCalendarEvents({
      userId,
      calendarId: config.calendarId,
      timeMin,
      timeMax,
      timeZone,
    });

    // Fetch existing entries for the day to detect overlaps
    const daySummary = await getDaySummary(userId, dayKey, timeZone);
    const existingEntries = daySummary.timeEntries;

    const suggestions = rawEvents
      .map((event) =>
        processCalendarEvent(event, existingEntries, timeZone, config.categoryRules),
      )
      .filter((item): item is CalendarEventSuggestionDTO => item !== null);

    return {
      events: suggestions,
      config,
      hasGoogleAuth: config.hasGoogleAuth,
    };
  } catch (err) {
    console.error("Error fetching or processing calendar schedule:", err);
    return {
      events: [],
      config,
      hasGoogleAuth: config.hasGoogleAuth,
    };
  }
}

/**
 * Batch-imports reviewed calendar events as completed TETRA time entries and tasks.
 */
export async function importCalendarEvents(
  userId: string,
  input: ImportCalendarEventsInputDTO,
): Promise<ImportCalendarEventsResultDTO> {
  const allCategories = await db.select().from(categories);
  const categoryByKey = new Map(allCategories.map((c) => [c.key, c]));
  const defaultCategory = allCategories.find((c) => c.key === "other_tasks") ?? allCategories[0];

  const createdTaskIds: string[] = [];
  const createdEntryIds: string[] = [];

  for (const item of input.events) {
    const targetCategory = categoryByKey.get(item.categoryKey) ?? defaultCategory;

    // Find or create task for the user with this name
    const existingTask = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.name, item.title.trim())))
      .limit(1);

    let taskId: string;
    if (existingTask.length > 0) {
      taskId = existingTask[0].id;
    } else {
      const createdTask = await db
        .insert(tasks)
        .values({
          userId,
          name: item.title.trim(),
          categoryId: targetCategory.id,
          isFavorite: false,
          lastUsedAt: new Date(),
        })
        .returning({ id: tasks.id });
      taskId = createdTask[0].id;
      createdTaskIds.push(taskId);
    }

    const startDate = new Date(item.startedAt);
    const endDate = new Date(item.endedAt);

    const createdEntry = await db
      .insert(timeEntries)
      .values({
        userId,
        taskId,
        categoryId: targetCategory.id,
        startedAt: startDate,
        endedAt: endDate,
        status: "completed",
        source: "manual",
        notes: item.notes?.trim() || null,
        pausedSeconds: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: timeEntries.id });

    createdEntryIds.push(createdEntry[0].id);
  }

  return {
    importedCount: createdEntryIds.length,
    createdTaskIds,
    createdEntryIds,
  };
}
