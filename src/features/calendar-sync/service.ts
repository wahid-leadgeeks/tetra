import { and, eq, gte, lte } from "drizzle-orm";

import { expandAttendanceBounds } from "@/features/attendance/service";
import { getDaySummary } from "@/features/daily-summary/service";
import { todayKey, zonedDayEnd, zonedDayKey, zonedDayStart } from "@/lib/time";
import { db } from "@/server/db";
import {
  calendarConfigs,
  calendarEvents,
  categories,
  tasks,
  timeEntries,
  users,
} from "@/server/db/schema";
import { processCalendarEvent } from "./domain";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  fetchCalendarEvents,
  listUserCalendars,
  patchGoogleCalendarEvent,
} from "./google";
import { matchCategory } from "./rules";
import type {
  CalendarConfigDTO,
  CalendarEventDTO,
  CalendarEventSuggestionDTO,
  CalendarGuestDTO,
  CalendarItemDTO,
  CreateCalendarEventInput,
  ImportCalendarEventsInputDTO,
  ImportCalendarEventsResultDTO,
  UpdateCalendarEventInput,
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

  // Expand attendance boundaries for each local day touched by imported events
  if (input.events.length > 0) {
    const userRows = await db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const tz = userRows[0]?.timezone || "UTC";

    const dayRanges = new Map<string, { minStart: Date; maxEnd: Date }>();
    for (const item of input.events) {
      const start = new Date(item.startedAt);
      const end = new Date(item.endedAt);
      const day = zonedDayKey(start, tz);
      const current = dayRanges.get(day);
      if (!current) {
        dayRanges.set(day, { minStart: start, maxEnd: end });
      } else {
        if (start.getTime() < current.minStart.getTime()) current.minStart = start;
        if (end.getTime() > current.maxEnd.getTime()) current.maxEnd = end;
      }
    }

    for (const [day, range] of dayRanges) {
      await expandAttendanceBounds(
        db,
        userId,
        day,
        { startedAt: range.minStart, endedAt: range.maxEnd },
        true,
        day === todayKey(tz),
      );
    }
  }

  return {
    importedCount: createdEntryIds.length,
    createdTaskIds,
    createdEntryIds,
  };
}

/**
 * Lists calendar events from TETRA database, optionally synchronizing with Google Calendar first.
 */
export async function listCalendarEvents(
  userId: string,
  options: {
    from?: string;
    to?: string;
    syncWithGoogle?: boolean;
    timeZone?: string;
  } = {},
): Promise<CalendarEventDTO[]> {
  const timeZone = options.timeZone || "Asia/Jakarta";
  const fromDate = options.from ? new Date(options.from) : undefined;
  const toDate = options.to ? new Date(options.to) : undefined;

  // Sync with Google Calendar if requested
  if (options.syncWithGoogle) {
    try {
      const config = await getCalendarConfig(userId);
      if (config.hasGoogleAuth) {
        const timeMin = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const timeMax = toDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

        const rawEvents = await fetchCalendarEvents({
          userId,
          calendarId: config.calendarId,
          timeMin,
          timeMax,
          timeZone,
        });

        const allCats = await db.select().from(categories);
        const catMap = new Map(allCats.map((c) => [c.key, c.id]));

        for (const raw of rawEvents) {
          const rawStart = new Date(raw.start.dateTime || raw.start.date || "");
          const rawEnd = new Date(raw.end.dateTime || raw.end.date || "");
          const isAllDay = !raw.start.dateTime;

          if (isNaN(rawStart.getTime()) || isNaN(rawEnd.getTime())) continue;

          // Check if already in DB
          const existing = await db
            .select()
            .from(calendarEvents)
            .where(
              and(
                eq(calendarEvents.userId, userId),
                eq(calendarEvents.googleEventId, raw.id),
              ),
            )
            .limit(1);

          if (existing.length > 0) {
            await db
              .update(calendarEvents)
              .set({
                title: raw.summary,
                description: raw.description,
                startAt: rawStart,
                endAt: rawEnd,
                allDay: isAllDay,
                meetUrl: raw.meetUrl,
                guests: raw.guests,
                htmlLink: raw.htmlLink,
                status: raw.status || "confirmed",
                updatedAt: new Date(),
              })
              .where(eq(calendarEvents.id, existing[0].id));
          } else {
            const matchedRule = matchCategory(raw.summary, raw.description, config.categoryRules);
            const categoryId = catMap.get(matchedRule.categoryKey) || null;

            await db.insert(calendarEvents).values({
              userId,
              calendarId: config.calendarId,
              googleEventId: raw.id,
              title: raw.summary,
              description: raw.description,
              categoryId,
              startAt: rawStart,
              endAt: rawEnd,
              allDay: isAllDay,
              meetUrl: raw.meetUrl,
              guests: raw.guests,
              sendUpdates: "all",
              htmlLink: raw.htmlLink,
              status: raw.status || "confirmed",
            });
          }
        }

        // Update lastSyncAt
        await db
          .update(calendarConfigs)
          .set({ lastSyncAt: new Date() })
          .where(eq(calendarConfigs.userId, userId));
      }
    } catch (err) {
      console.error("Error in syncWithGoogle during listCalendarEvents:", err);
    }
  }

  // Build DB query with optional date filters
  const conditions = [eq(calendarEvents.userId, userId)];
  if (fromDate) {
    conditions.push(gte(calendarEvents.endAt, fromDate));
  }
  if (toDate) {
    conditions.push(lte(calendarEvents.startAt, toDate));
  }

  const rows = await db
    .select({
      id: calendarEvents.id,
      userId: calendarEvents.userId,
      title: calendarEvents.title,
      description: calendarEvents.description,
      categoryId: calendarEvents.categoryId,
      categoryKey: categories.key,
      categoryName: categories.name,
      startAt: calendarEvents.startAt,
      endAt: calendarEvents.endAt,
      allDay: calendarEvents.allDay,
      calendarId: calendarEvents.calendarId,
      googleEventId: calendarEvents.googleEventId,
      meetUrl: calendarEvents.meetUrl,
      guests: calendarEvents.guests,
      sendUpdates: calendarEvents.sendUpdates,
      htmlLink: calendarEvents.htmlLink,
      status: calendarEvents.status,
      createdAt: calendarEvents.createdAt,
      updatedAt: calendarEvents.updatedAt,
    })
    .from(calendarEvents)
    .leftJoin(categories, eq(calendarEvents.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(calendarEvents.startAt);

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    title: r.title,
    description: r.description,
    categoryId: r.categoryId,
    categoryKey: r.categoryKey ?? null,
    categoryName: r.categoryName ?? null,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
    allDay: r.allDay,
    calendarId: r.calendarId,
    googleEventId: r.googleEventId,
    meetUrl: r.meetUrl,
    guests: (r.guests as CalendarGuestDTO[]) || [],
    sendUpdates: (r.sendUpdates as "all" | "none") || "all",
    htmlLink: r.htmlLink,
    status: (r.status as "confirmed" | "cancelled") || "confirmed",
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/**
 * Creates a new calendar event in TETRA and synchronizes with Google Calendar if connected.
 */
export async function createCalendarEvent(
  userId: string,
  input: CreateCalendarEventInput,
  timeZone: string,
): Promise<CalendarEventDTO> {
  const startDate = new Date(input.startAt);
  const endDate = new Date(input.endAt);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error("Invalid start or end date format");
  }
  if (endDate <= startDate && !input.allDay) {
    throw new Error("End time must be after start time");
  }

  const config = await getCalendarConfig(userId);

  let googleEventId: string | null = null;
  let meetUrl: string | null = null;
  let htmlLink: string | null = null;
  let guests: CalendarGuestDTO[] = (input.guests ?? []).map((g) =>
    typeof g === "string"
      ? { email: g, displayName: null, responseStatus: null }
      : { email: g.email, displayName: g.displayName || null, responseStatus: null },
  );

  // If user has Google OAuth, create in Google Calendar
  if (config.hasGoogleAuth) {
    try {
      const googleRes = await createGoogleCalendarEvent({
        userId,
        calendarId: config.calendarId,
        title: input.title,
        description: input.description,
        startAt: input.startAt,
        endAt: input.endAt,
        allDay: input.allDay,
        timeZone,
        createMeet: input.createMeet,
        guests: input.guests,
        sendUpdates: input.sendUpdates ?? (guests.length > 0 ? "all" : "none"),
      });

      if (googleRes) {
        googleEventId = googleRes.googleEventId;
        meetUrl = googleRes.meetUrl;
        htmlLink = googleRes.htmlLink;
        if (googleRes.guests.length > 0) {
          guests = googleRes.guests;
        }
      }
    } catch (err) {
      console.error("Failed to create Google Calendar event via API:", err);
    }
  }

  const [created] = await db
    .insert(calendarEvents)
    .values({
      userId,
      calendarId: config.calendarId || "primary",
      googleEventId,
      title: input.title,
      description: input.description || null,
      categoryId: input.categoryId || null,
      startAt: startDate,
      endAt: endDate,
      allDay: input.allDay ?? false,
      meetUrl,
      guests,
      sendUpdates: input.sendUpdates ?? "all",
      htmlLink,
      status: "confirmed",
    })
    .returning();

  let categoryKey: string | null = null;
  let categoryName: string | null = null;
  if (created.categoryId) {
    const [cat] = await db
      .select({ key: categories.key, name: categories.name })
      .from(categories)
      .where(eq(categories.id, created.categoryId))
      .limit(1);
    if (cat) {
      categoryKey = cat.key;
      categoryName = cat.name;
    }
  }

  return {
    id: created.id,
    userId: created.userId,
    title: created.title,
    description: created.description,
    categoryId: created.categoryId,
    categoryKey,
    categoryName,
    startAt: created.startAt.toISOString(),
    endAt: created.endAt.toISOString(),
    allDay: created.allDay,
    calendarId: created.calendarId,
    googleEventId: created.googleEventId,
    meetUrl: created.meetUrl,
    guests: (created.guests as CalendarGuestDTO[]) || [],
    sendUpdates: (created.sendUpdates as "all" | "none") || "all",
    htmlLink: created.htmlLink,
    status: (created.status as "confirmed" | "cancelled") || "confirmed",
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

/**
 * Patches an existing calendar event and synchronizes modifications to Google Calendar.
 */
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  input: UpdateCalendarEventInput,
  timeZone: string,
): Promise<CalendarEventDTO> {
  const existingRows = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) {
    throw new Error("Event not found");
  }

  const startDate = input.startAt ? new Date(input.startAt) : existing.startAt;
  const endDate = input.endAt ? new Date(input.endAt) : existing.endAt;

  if (endDate <= startDate && !(input.allDay ?? existing.allDay)) {
    throw new Error("End time must be after start time");
  }

  let meetUrl = existing.meetUrl;
  let htmlLink = existing.htmlLink;
  let guests = input.guests
    ? input.guests.map((g) =>
        typeof g === "string"
          ? { email: g, displayName: null, responseStatus: null }
          : { email: g.email, displayName: g.displayName || null, responseStatus: null },
      )
    : (existing.guests as CalendarGuestDTO[]) || [];

  if (existing.googleEventId) {
    try {
      const googleRes = await patchGoogleCalendarEvent({
        userId,
        calendarId: existing.calendarId,
        googleEventId: existing.googleEventId,
        title: input.title,
        description: input.description,
        startAt: input.startAt,
        endAt: input.endAt,
        allDay: input.allDay,
        timeZone,
        createMeet: input.createMeet,
        guests: input.guests,
        sendUpdates: input.sendUpdates,
      });

      if (googleRes) {
        if (googleRes.meetUrl) meetUrl = googleRes.meetUrl;
        if (googleRes.htmlLink) htmlLink = googleRes.htmlLink;
        if (googleRes.guests && googleRes.guests.length > 0) {
          guests = googleRes.guests;
        }
      }
    } catch (err) {
      console.error("Failed to patch Google Calendar event:", err);
    }
  }

  const [updated] = await db
    .update(calendarEvents)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.startAt !== undefined ? { startAt: startDate } : {}),
      ...(input.endAt !== undefined ? { endAt: endDate } : {}),
      ...(input.allDay !== undefined ? { allDay: input.allDay } : {}),
      ...(input.sendUpdates !== undefined ? { sendUpdates: input.sendUpdates } : {}),
      meetUrl,
      htmlLink,
      guests,
      updatedAt: new Date(),
    })
    .where(eq(calendarEvents.id, eventId))
    .returning();

  let categoryKey: string | null = null;
  let categoryName: string | null = null;
  if (updated.categoryId) {
    const [cat] = await db
      .select({ key: categories.key, name: categories.name })
      .from(categories)
      .where(eq(categories.id, updated.categoryId))
      .limit(1);
    if (cat) {
      categoryKey = cat.key;
      categoryName = cat.name;
    }
  }

  return {
    id: updated.id,
    userId: updated.userId,
    title: updated.title,
    description: updated.description,
    categoryId: updated.categoryId,
    categoryKey,
    categoryName,
    startAt: updated.startAt.toISOString(),
    endAt: updated.endAt.toISOString(),
    allDay: updated.allDay,
    calendarId: updated.calendarId,
    googleEventId: updated.googleEventId,
    meetUrl: updated.meetUrl,
    guests: (updated.guests as CalendarGuestDTO[]) || [],
    sendUpdates: (updated.sendUpdates as "all" | "none") || "all",
    htmlLink: updated.htmlLink,
    status: (updated.status as "confirmed" | "cancelled") || "confirmed",
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

/**
 * Deletes a calendar event from TETRA and Google Calendar.
 */
export async function deleteCalendarEvent(userId: string, eventId: string): Promise<boolean> {
  const existingRows = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) {
    return false;
  }

  if (existing.googleEventId) {
    try {
      await deleteGoogleCalendarEvent({
        userId,
        calendarId: existing.calendarId,
        googleEventId: existing.googleEventId,
      });
    } catch (err) {
      console.error("Failed to delete event from Google Calendar:", err);
    }
  }

  await db.delete(calendarEvents).where(eq(calendarEvents.id, eventId));
  return true;
}

