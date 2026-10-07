import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  importCalendarEvents: vi.fn(),
}));

vi.mock("@/server/auth", () => ({ auth: mocks.auth }));
vi.mock("@/features/calendar-sync/service", () => ({
  importCalendarEvents: mocks.importCalendarEvents,
}));

import { POST } from "./route";

const event = (over: Record<string, unknown> = {}) => ({
  eventId: "evt-1",
  title: "Standup",
  categoryKey: "meeting",
  startedAt: "2026-01-05T02:00:00Z",
  endedAt: "2026-01-05T02:30:00Z",
  ...over,
});

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/calendar/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
  mocks.importCalendarEvents.mockResolvedValue({
    importedCount: 1,
    skippedCount: 0,
    skippedEventIds: [],
    createdTaskIds: [],
    createdEntryIds: [],
  });
});

describe("POST /api/calendar/import", () => {
  it("rejects a whitespace-only title with 400 and never calls the service", async () => {
    const res = await post({ events: [event({ title: "   " })] });
    expect(res.status).toBe(400);
    expect(mocks.importCalendarEvents).not.toHaveBeenCalled();
  });

  it("trims titles and passes sourceTitle / isAllDay through; blank sourceTitle is accepted", async () => {
    const res = await post({
      events: [
        event({ title: "  Standup  ", sourceTitle: " Daily Standup ", isAllDay: false }),
        event({ eventId: "evt-2", sourceTitle: "  " }),
      ],
    });
    expect(res.status).toBe(200);
    const [userId, input] = mocks.importCalendarEvents.mock.calls[0];
    expect(userId).toBe("user-1");
    expect(input.events[0]).toMatchObject({ title: "Standup", sourceTitle: "Daily Standup", isAllDay: false });
    expect(input.events[1].sourceTitle).toBe("");
  });

  it("returns 401 without a session", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await post({ events: [event()] });
    expect(res.status).toBe(401);
  });
});
