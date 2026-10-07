import { expect, test, type Page } from "@playwright/test";
import { expectToast, login } from "./helpers";

const TIME_ZONE = process.env.DEFAULT_TIMEZONE ?? "Asia/Jakarta";

function todayInZone(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

/** Offset (ms) of TIME_ZONE from UTC at the given instant. */
function zoneOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** ISO instants for a meeting on today's local date at `hour`:00, lasting 30 minutes. */
function meetingWindow(hour: number): { day: string; startAt: string; endAt: string } {
  const day = todayInZone();
  const guess = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
  const start = new Date(guess.getTime() - zoneOffsetMs(guess));
  const end = new Date(start.getTime() + 30 * 60_000);
  return { day, startAt: start.toISOString(), endAt: end.toISOString() };
}

async function createCalendarEvent(
  page: Page,
  title: string,
  window: { startAt: string; endAt: string },
): Promise<void> {
  const res = await page.request.post("/api/calendar/events", {
    data: { title, startAt: window.startAt, endAt: window.endAt },
  });
  expect(res.status()).toBe(201);
}

test("today: imports a scheduled meeting from the schedule card", async ({ page }) => {
  await login(page);
  const w = meetingWindow(10);
  await createCalendarEvent(page, "E2E Standup", w);

  await page.goto("/");
  const card = page.getByTestId("calendar-schedule-card");
  await expect(card).toContainText("E2E Standup", { timeout: 15_000 });

  await card.getByTestId("calendar-import-button").click();
  await page.getByTestId("calendar-import-confirm").click();
  await expectToast(page, "Imported 1");

  await page.reload();
  const reloaded = page.getByTestId("calendar-schedule-card");
  await expect(reloaded).toContainText("E2E Standup", { timeout: 15_000 });
  await expect(reloaded.getByText("Imported", { exact: true })).toBeVisible();
  await expect(reloaded.getByTestId("calendar-import-button")).toBeDisabled();
});

test("timeline: imports a scheduled meeting for the viewed day", async ({ page }) => {
  await login(page);
  const w = meetingWindow(11);
  await createCalendarEvent(page, "E2E Planning", w);

  await page.getByTestId("nav-timeline").click();
  await expect(page).toHaveURL(/\/timeline/, { timeout: 15_000 });

  const card = page.getByTestId("timeline-schedule-card");
  await expect(card).toContainText("E2E Planning", { timeout: 15_000 });

  await card.getByTestId("calendar-import-button").click();
  await page.getByTestId("calendar-import-confirm").click();
  await expectToast(page, "Imported 1");

  await expect(page.locator('[data-testid="timeline"]')).toContainText("E2E Planning", {
    timeout: 15_000,
  });

  await page.reload();
  const reloaded = page.getByTestId("timeline-schedule-card");
  await expect(reloaded).toContainText("E2E Planning", { timeout: 15_000 });
  await expect(reloaded.getByText("Imported", { exact: true })).toBeVisible();
});

test("api: re-importing the same event is idempotent", async ({ page }) => {
  await login(page);
  const w = meetingWindow(13);
  const payload = {
    events: [
      {
        eventId: "e2e-idempotent-1",
        title: "E2E Retro",
        categoryKey: "meeting",
        startedAt: w.startAt,
        endedAt: w.endAt,
      },
    ],
  };

  const first = await page.request.post("/api/calendar/import", { data: payload });
  expect(first.ok()).toBe(true);
  expect(await first.json()).toMatchObject({ importedCount: 1, skippedCount: 0 });

  const second = await page.request.post("/api/calendar/import", { data: payload });
  expect(second.ok()).toBe(true);
  expect(await second.json()).toMatchObject({
    importedCount: 0,
    skippedCount: 1,
    skippedEventIds: ["e2e-idempotent-1"],
  });

  const dayRes = await page.request.get(`/api/days/${w.day}`);
  expect(dayRes.ok()).toBe(true);
  const day = (await dayRes.json()) as { timeEntries: { taskName: string }[] };
  expect(day.timeEntries.filter((e) => e.taskName === "E2E Retro")).toHaveLength(1);
});
