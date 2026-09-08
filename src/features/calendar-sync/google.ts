/**
 * Google Calendar client construction & API calls — mirrors sheets-sync/google.ts.
 * googleapis is loaded lazily so routes compile fast and unconfigured environments
 * never pay the import cost.
 */
import { eq } from "drizzle-orm";
import type { calendar_v3 } from "googleapis";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { env } from "@/server/env";
import type { CalendarItemDTO } from "./types";

export interface GetCalendarClientOptions {
  userId?: string;
  accessToken?: string;
}

/**
 * Returns an authenticated Google Calendar client.
 */
export async function getCalendarClient(
  options?: GetCalendarClientOptions,
): Promise<calendar_v3.Calendar | null> {
  const { google } = await import("googleapis");

  // 1. User OAuth credentials from DB (preferred because it has refresh token & auto-refresh persistence)
  if (options?.userId) {
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, options.userId))
      .limit(1);

    const user = userRows[0];
    if (
      user &&
      (user.googleAccessToken || user.googleRefreshToken || options.accessToken)
    ) {
      const clientId =
        env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || undefined;
      const clientSecret =
        env.GOOGLE_CLIENT_SECRET ||
        process.env.GOOGLE_CLIENT_SECRET ||
        undefined;

      const oauth2 = new google.auth.OAuth2(clientId, clientSecret);

      oauth2.setCredentials({
        access_token: user.googleAccessToken || options.accessToken,
        refresh_token: user.googleRefreshToken ?? undefined,
      });

      // Refresh if expired or expiring within 60 seconds
      const isExpired =
        !user.googleAccessToken ||
        (user.googleTokenExpiresAt &&
          user.googleTokenExpiresAt.getTime() < Date.now() + 60_000);

      if (
        isExpired &&
        user.googleRefreshToken &&
        (clientId || process.env.NODE_ENV === "test")
      ) {
        try {
          const { credentials } = await oauth2.refreshAccessToken();
          if (credentials.access_token) {
            oauth2.setCredentials(credentials);
            await db
              .update(users)
              .set({
                googleAccessToken: credentials.access_token,
                ...(credentials.refresh_token
                  ? { googleRefreshToken: credentials.refresh_token }
                  : {}),
                googleTokenExpiresAt: credentials.expiry_date
                  ? new Date(credentials.expiry_date)
                  : null,
              })
              .where(eq(users.id, user.id));
          }
        } catch (refreshErr) {
          console.error("Failed to refresh Google OAuth token for calendar:", refreshErr);
          if (options.accessToken) {
            oauth2.setCredentials({ access_token: options.accessToken });
          }
        }
      }

      return google.calendar({ version: "v3", auth: oauth2 });
    }
  }

  // 2. Explicit access token fallback
  if (options?.accessToken) {
    const oauth2 = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || undefined,
      env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || undefined,
    );
    oauth2.setCredentials({ access_token: options.accessToken });
    return google.calendar({ version: "v3", auth: oauth2 });
  }

  return null;
}

/**
 * Lists the user's available calendars (Primary, Work, etc.).
 */
export async function listUserCalendars(
  options: GetCalendarClientOptions,
): Promise<CalendarItemDTO[]> {
  const client = await getCalendarClient(options);
  if (!client) {
    // Return default primary calendar placeholder if not connected
    return [{ id: "primary", summary: "Primary Calendar", primary: true }];
  }

  try {
    const res = await client.calendarList.list();
    const items = res.data.items ?? [];
    return items.map((item) => ({
      id: item.id ?? "primary",
      summary: item.summary ?? "Calendar",
      primary: item.primary ?? false,
      description: item.description ?? undefined,
    }));
  } catch (err) {
    console.error("Failed to list Google Calendars:", err);
    return [{ id: "primary", summary: "Primary Calendar", primary: true }];
  }
}

export interface RawCalendarEvent {
  id: string;
  summary: string;
  description?: string | null;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status?: string;
}

/**
 * Fetches events in a UTC time range from Google Calendar API.
 */
export async function fetchCalendarEvents(options: {
  userId: string;
  calendarId?: string;
  timeMin: Date;
  timeMax: Date;
  timeZone: string;
}): Promise<RawCalendarEvent[]> {
  const client = await getCalendarClient({ userId: options.userId });
  if (!client) {
    return [];
  }

  try {
    const res = await client.events.list({
      calendarId: options.calendarId || "primary",
      timeMin: options.timeMin.toISOString(),
      timeMax: options.timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      timeZone: options.timeZone,
    });

    const items = res.data.items ?? [];
    return items
      .filter((item) => item.status !== "cancelled" && item.summary)
      .map((item) => ({
        id: item.id ?? Math.random().toString(36).slice(2),
        summary: item.summary ?? "Untitled Event",
        description: item.description ?? null,
        start: {
          dateTime: item.start?.dateTime ?? undefined,
          date: item.start?.date ?? undefined,
        },
        end: {
          dateTime: item.end?.dateTime ?? undefined,
          date: item.end?.date ?? undefined,
        },
        status: item.status ?? "confirmed",
      }));
  } catch (err) {
    console.error("Failed to fetch Google Calendar events:", err);
    return [];
  }
}
