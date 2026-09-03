import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("critical flow: login → work → task → break → stop → review → sync", async ({
  page,
}) => {
  // 1. Login
  await login(page);
  await expect(page.getByTestId("clock-in")).toBeVisible();

  // 2. Start work
  await page.getByTestId("clock-in").click();
  await expect(page.getByTestId("break-start")).toBeVisible({ timeout: 10_000 });

  // 3. Start task
  await page.getByTestId("log-activity").click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("category-select").click();
  await page.getByRole("option", { name: "Website Management" }).click();
  await dialog.getByTestId("task-name-input").fill("E2E Critical Flow");
  await dialog.getByTestId("start-task").click();
  const activeCard = page.getByTestId("active-timer");
  await expect(activeCard).toBeVisible({ timeout: 10_000 });
  await expect(
    activeCard.locator("xpath=preceding-sibling::div").getByText("E2E Critical Flow"),
  ).toBeVisible({ timeout: 10_000 });

  // 4. Stop task
  await page.getByTestId("stop-task").click();
  await expect(activeCard).toBeHidden({ timeout: 10_000 });

  // 5. Break + end break (button toggles break-end while a break is active)
  await page.getByTestId("break-start").click();
  await expect(page.getByTestId("break-end")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("break-end").click();
  await expect(page.getByTestId("break-start")).toBeVisible({ timeout: 10_000 });

  // 6. Stop work (destructive confirmation)
  await page.getByTestId("clock-out").click();
  await page.getByTestId("clock-out-confirm").click();
  await expect(page.getByText("Done for today")).toBeVisible({ timeout: 10_000 });

  // 7. Review the day
  await page.getByTestId("nav-reports").click();
  await expect(page.getByTestId("review-attendance")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("review-work-total")).toBeVisible();
  await page.getByTestId("review-submit").click();
  await expect(
    page.getByTestId("review-submit").locator('[data-slot="badge"]'),
  ).toBeHidden();
  await expect(
    page.locator('[data-slot="badge"]').filter({ hasText: "Reviewed" }),
  ).toBeVisible({ timeout: 10_000 });

  // 8. Sync — no Google credentials configured: expect a clear, graceful error
  await page.getByTestId("sync-button").click();
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: /config/i }),
  ).toBeVisible({ timeout: 10_000 });

  // 9. Timeline shows the tracked entry
  await page.getByTestId("nav-timeline").click();
  await expect(page.getByTestId("timeline")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("timeline")).toContainText("E2E Critical Flow");
});
