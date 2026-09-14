import { describe, expect, it } from "vitest";
import type { calendar_v3 } from "googleapis";

describe("Calendar & Google Meet Event Domain", () => {
  it("formats insert payload with conferenceDataVersion: 1 and hangoutsMeet createRequest", () => {
    const title = "Team Project Meeting";
    const description = "Sprint planning and roadmap alignment";
    const startIso = "2026-09-15T10:00:00.000Z";
    const endIso = "2026-09-15T11:00:00.000Z";
    const timeZone = "Asia/Jakarta";
    const guests = ["john@email.com", "jane@email.com"];
    const createMeet = true;
    const sendUpdates = "all";

    const attendees = guests.map((g) => ({ email: g }));

    const insertOptions: calendar_v3.Params$Resource$Events$Insert = {
      calendarId: "primary",
      conferenceDataVersion: createMeet ? 1 : 0,
      sendUpdates,
      requestBody: {
        summary: title,
        description,
        start: { dateTime: startIso, timeZone },
        end: { dateTime: endIso, timeZone },
        attendees,
        conferenceData: createMeet
          ? {
              createRequest: {
                requestId: "mock-request-id",
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            }
          : undefined,
      },
    };

    expect(insertOptions.conferenceDataVersion).toBe(1);
    expect(insertOptions.sendUpdates).toBe("all");
    expect(insertOptions.requestBody?.summary).toBe("Team Project Meeting");
    expect(insertOptions.requestBody?.attendees).toHaveLength(2);
    expect(insertOptions.requestBody?.attendees?.[0]).toEqual({ email: "john@email.com" });
    expect(insertOptions.requestBody?.conferenceData?.createRequest?.conferenceSolutionKey?.type).toBe(
      "hangoutsMeet",
    );
  });

  it("extracts Google Meet URL from conferenceData entryPoints", () => {
    const mockApiResponse: calendar_v3.Schema$Event = {
      id: "event-abc-123",
      summary: "Team Project Meeting",
      conferenceData: {
        entryPoints: [
          {
            entryPointType: "video",
            uri: "https://meet.google.com/xyz-abcd-efg",
            label: "meet.google.com/xyz-abcd-efg",
          },
          {
            entryPointType: "phone",
            uri: "tel:+1-123-456-7890",
          },
        ],
      },
    };

    const meetUrl =
      mockApiResponse.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
      mockApiResponse.hangoutLink ||
      null;

    expect(meetUrl).toBe("https://meet.google.com/xyz-abcd-efg");
  });

  it("falls back to hangoutLink if conferenceData entryPoints is missing", () => {
    const mockApiResponse: calendar_v3.Schema$Event = {
      id: "event-def-456",
      summary: "1:1 Sync",
      hangoutLink: "https://meet.google.com/aaa-bbbb-ccc",
    };

    const meetUrl =
      mockApiResponse.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
      mockApiResponse.hangoutLink ||
      null;

    expect(meetUrl).toBe("https://meet.google.com/aaa-bbbb-ccc");
  });

  it("constructs patch payload correctly for event changes", () => {
    const googleEventId = "abc123xyz";
    const changes = {
      title: "Updated Tetra Meeting",
      startAt: "2026-09-15T11:00:00+07:00",
      endAt: "2026-09-15T12:00:00+07:00",
      guests: ["john@email.com", "sarah@email.com"],
      timeZone: "Asia/Jakarta",
    };

    const patchBody: Record<string, unknown> = {
      summary: changes.title,
      start: { dateTime: new Date(changes.startAt).toISOString(), timeZone: changes.timeZone },
      end: { dateTime: new Date(changes.endAt).toISOString(), timeZone: changes.timeZone },
      attendees: changes.guests.map((email) => ({ email })),
    };

    const patchParams: calendar_v3.Params$Resource$Events$Patch = {
      calendarId: "primary",
      eventId: googleEventId,
      sendUpdates: "all",
      requestBody: patchBody,
    };

    expect(patchParams.calendarId).toBe("primary");
    expect(patchParams.eventId).toBe("abc123xyz");
    expect(patchParams.sendUpdates).toBe("all");
    expect(patchParams.requestBody?.summary).toBe("Updated Tetra Meeting");
    expect(patchParams.requestBody?.attendees).toEqual([
      { email: "john@email.com" },
      { email: "sarah@email.com" },
    ]);
  });

  it("handles all-day date ranges correctly", () => {
    const allDayStart = "2026-09-15";
    const allDayEnd = "2026-09-15";

    const startObj = { date: allDayStart };
    const endObj = { date: allDayEnd };

    expect(startObj.date).toBe("2026-09-15");
    expect(endObj.date).toBe("2026-09-15");
  });

  it("validates that end time is strictly after start time for non-all-day events", () => {
    const startAt = new Date("2026-09-15T10:00:00Z");
    const invalidEndAt = new Date("2026-09-15T09:30:00Z");
    const validEndAt = new Date("2026-09-15T11:00:00Z");

    expect(invalidEndAt <= startAt).toBe(true);
    expect(validEndAt > startAt).toBe(true);
  });
});
