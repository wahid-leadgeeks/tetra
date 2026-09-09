import { expect, test } from "@playwright/test";
import { uniqueEmail } from "./helpers";
import {
  generateVisualGalleryMarkdown,
  takeVisualScreenshot,
} from "./visual-helper";

test.describe("Comprehensive Mobile Responsive E2E Journey with Visual Verification", () => {
  test.afterAll(async () => {
    generateVisualGalleryMarkdown();
  });

  test("mobile responsive flow: auth → today → sticky bar → timeline → dashboard → reports → tasks → settings", async ({
    page,
  }, testInfo) => {
    // 1. Mobile viewport (iPhone 14 / modern standard smartphone)
    await page.setViewportSize({ width: 390, height: 844 });

    // 2. Mobile Auth view
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await takeVisualScreenshot(
      page,
      testInfo,
      "mobile/01-mobile-login.png",
      "Mobile login screen with touch-friendly controls",
      "Mobile Experience",
    );

    // 3. Dev login submission
    await page.getByTestId("login-email").fill(uniqueEmail());
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("clock-in")).toBeVisible({ timeout: 15_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "mobile/02-mobile-today-not-clocked-in.png",
      "Mobile Today view with touch start actions and bottom navigation",
      "Mobile Experience",
    );

    // 4. Start work and active task to verify mobile sticky timer bar
    await page.getByTestId("clock-in").click();
    await expect(page.getByTestId("clock-out")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("log-activity").click();
    const dialog = page
      .locator('[role="dialog"]')
      .filter({ has: page.getByTestId("category-select") });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByTestId("category-select").click();
    await page.getByRole("option", { name: "Website Management" }).click();
    await dialog.getByTestId("task-name-input").fill("Mobile On-the-Go Task");
    await dialog.getByTestId("start-task").click();

    // Verify Sticky Task Bar appears on mobile
    await expect(page.getByTestId("sticky-timer")).toBeVisible({
      timeout: 10_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "mobile/03-mobile-today-active-sticky-bar.png",
      "Mobile Today view with persistent sticky active-task bar",
      "Mobile Experience",
    );

    // Stop task via sticky bar stop button
    await page.getByTestId("sticky-stop").click();
    await page.getByTestId("stop-task-confirm").click();
    await expect(page.getByTestId("sticky-timer")).toBeHidden({
      timeout: 10_000,
    });

    // 5. Mobile Timeline view
    await page.goto("/timeline");
    await expect(page.getByTestId("timeline")).toBeVisible({ timeout: 15_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "mobile/04-mobile-timeline.png",
      "Mobile Timeline view displaying compact activity items and gaps",
      "Mobile Experience",
    );

    // 6. Mobile Dashboard view
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-tabs").first()).toBeVisible({
      timeout: 15_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "mobile/05-mobile-dashboard.png",
      "Mobile Dashboard view with adaptive KPI cards and tabs",
      "Mobile Experience",
    );

    // 7. Mobile Reports view
    await page.goto("/reports");
    await expect(page.getByTestId("review-attendance")).toBeVisible({
      timeout: 15_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "mobile/06-mobile-reports.png",
      "Mobile Daily Review view with touch-friendly sync options",
      "Mobile Experience",
    );

    // 8. Mobile Tasks view
    await page.goto("/tasks");
    await expect(page.getByTestId("tasks-list")).toBeVisible({ timeout: 15_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "mobile/07-mobile-tasks.png",
      "Mobile Tasks view with one-tap start buttons and star favorites",
      "Mobile Experience",
    );

    // 9. Mobile Settings view
    await page.goto("/settings");
    await expect(page.getByTestId("settings-spreadsheet-id")).toBeVisible({
      timeout: 30_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "mobile/08-mobile-settings.png",
      "Mobile Settings view with responsive configuration fields",
      "Mobile Experience",
    );
  });
});
