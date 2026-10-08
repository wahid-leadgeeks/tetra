import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_SHEET_MAPPING } from "../../src/features/sheets-sync/mapping";
import { login } from "./helpers";

/** Clock in, then start and stop one task on Today. */
async function trackOneTask(page: Page, taskName: string): Promise<void> {
  await page.getByTestId("clock-in").click();
  await expect(page.getByTestId("break-start")).toBeVisible({ timeout: 10_000 });

  await page.getByTestId("log-activity").click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("category-select").click();
  await page.getByRole("option", { name: "Website Management" }).click();
  await dialog.getByTestId("task-name-input").fill(taskName);
  await dialog.getByTestId("start-task").click();
  const activeCard = page.getByTestId("active-timer");
  await expect(activeCard).toBeVisible({ timeout: 10_000 });

  await page.getByTestId("stop-task").click();
  await page.getByTestId("stop-task-confirm").click();
  await expect(activeCard).toBeHidden({ timeout: 10_000 });
}

test("timeline shows Not synced indicator and a non-retryable credentials error on Sync now", async ({
  page,
}) => {
  await login(page);

  // A sync config row exists, but no Google tokens or GOOGLE_* env do, so
  // getSheetsClient returns null and every sync fails with "credentials".
  const put = await page.request.put("/api/sync-config", {
    data: {
      spreadsheetId: "e2e-sheet-00001",
      worksheetName: "Sheet1",
      mapping: DEFAULT_SHEET_MAPPING,
    },
  });
  expect(put.ok()).toBeTruthy();

  // The stop-task auto-sync is silent on not_configured; no toast assertions.
  await trackOneTask(page, "E2E Needs Sync");

  await page.getByTestId("nav-timeline").click();
  await expect(page.getByTestId("timeline-needs-sync")).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("timeline-sync-now").click();
  const toast = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: /credentials not configured/i })
    .last();
  await expect(toast).toBeVisible({ timeout: 10_000 });
  // Credentials errors are not transient: no Retry action.
  await expect(toast.getByRole("button", { name: "Retry" })).toHaveCount(0);

  await expect(page.getByTestId("timeline")).toBeVisible();
  await expect(page.getByTestId("timeline-needs-sync")).toBeVisible();
});

test("timeline hides the Not synced indicator for a user without a sync config", async ({
  page,
}) => {
  await login(page);
  await trackOneTask(page, "E2E No Config");

  // Register before the click so the response cannot be missed.
  const configResponse = page.waitForResponse(
    (r) => r.url().includes("/api/sync-config") && r.ok(),
  );
  await page.getByTestId("nav-timeline").click();
  await configResponse;

  // Summary loaded, so the absence below is not just "not loaded yet".
  await expect(page.getByTestId("timeline-summary")).toContainText(/task/, {
    timeout: 15_000,
  });
  await expect(page.getByTestId("timeline-needs-sync")).toHaveCount(0);
});
