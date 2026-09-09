import { expect, test } from "@playwright/test";
import { uniqueEmail } from "./helpers";
import {
  generateVisualGalleryMarkdown,
  takeVisualScreenshot,
} from "./visual-helper";

test.describe("Comprehensive Desktop E2E Journey with Visual Verification", () => {
  test.afterAll(async () => {
    generateVisualGalleryMarkdown();
  });

  test("full desktop flow: auth → tour → attendance → timer → pause/resume → break → stop → timeline → tasks → reports → dashboard → settings → shortcuts → sign-out", async ({
    page,
    context,
  }, testInfo) => {
    // 1. Initial desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // 2. Auth: Land on login page
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/01-login-screen.png",
      "Login screen with Google Auth and Dev Access",
      "Authentication & Onboarding",
    );

    // 3. Dev login submission
    await page.getByTestId("login-email").fill(uniqueEmail());
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("nav-today")).toBeVisible({ timeout: 15_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/02-today-not-clocked-in.png",
      "Today screen before clocking in (calm empty state)",
      "Today & Attendance",
    );

    // 4. Guided Tour spotlight
    await page.getByTestId("today-guide-tour").click();
    const tourModal = page.locator('[role="dialog"][aria-label*="Guide Tour"]');
    await expect(tourModal).toBeVisible({ timeout: 5_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/03-guided-tour-spotlight-step1.png",
      "Guided tour step 1 spotlight highlighting Today hero",
      "Onboarding & Assistance",
    );

    // Advance to tour step 2
    await tourModal
      .getByRole("button", { name: "Next", exact: true })
      .click();
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/04-guided-tour-spotlight-step2.png",
      "Guided tour step 2 spotlight highlighting Today overview",
      "Onboarding & Assistance",
    );

    // Close tour
    await tourModal.getByRole("button", { name: "Close guide tour" }).click();
    await expect(tourModal).toBeHidden({ timeout: 5_000 });

    // 5. Start work day (Clock in)
    await page.getByTestId("clock-in").click();
    await expect(page.getByTestId("clock-out")).toBeVisible({ timeout: 10_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/05-today-clocked-in.png",
      "Today screen clocked in and ready for tasks",
      "Today & Attendance",
    );

    // 6. Start a task
    await page.getByTestId("log-activity").click();
    const startTaskDialog = page
      .locator('[role="dialog"]')
      .filter({ has: page.getByTestId("category-select") });
    await expect(startTaskDialog).toBeVisible({ timeout: 10_000 });
    await startTaskDialog.getByTestId("category-select").click();
    await page.getByRole("option", { name: "Website Management" }).click();
    await startTaskDialog
      .getByTestId("task-name-input")
      .fill("Comprehensive E2E Architecture");
    await startTaskDialog
      .locator("#start-task-notes")
      .fill("Automated visual regression and journey verification");
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/06-start-task-dialog.png",
      "Start task modal dialog with category, task name, and notes",
      "Activity Tracking",
    );

    await startTaskDialog.getByTestId("start-task").click();
    const activeTimer = page.getByTestId("active-timer");
    await expect(activeTimer).toBeVisible({ timeout: 10_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/07-task-active-running.png",
      "Today screen with live active task stopwatch running",
      "Activity Tracking",
    );

    // 7. Pause and Resume task
    await page.getByTestId("pause-task").click();
    await expect(page.getByTestId("resume-task")).toBeVisible({
      timeout: 10_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/08-task-paused.png",
      "Today screen with paused task timer",
      "Activity Tracking",
    );

    await page.getByTestId("resume-task").click();
    await expect(page.getByTestId("pause-task")).toBeVisible({
      timeout: 10_000,
    });

    // 8. Break management
    await page.getByTestId("break-start").click();
    await expect(page.getByTestId("break-end")).toBeVisible({ timeout: 10_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/09-break-active.png",
      "Today screen with active break indicator",
      "Today & Attendance",
    );

    await page.getByTestId("break-end").click();
    await expect(page.getByTestId("break-start")).toBeVisible({
      timeout: 10_000,
    });

    // 9. Stop task confirmation & Stop
    await page.getByTestId("stop-task").click();
    await expect(page.getByText("Stop current task?")).toBeVisible({
      timeout: 5_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/10-stop-task-confirm-modal.png",
      "Stop task confirmation safety modal",
      "Confirmations & Safety",
    );
    await page.getByTestId("stop-task-confirm").click();
    await expect(activeTimer).toBeHidden({ timeout: 10_000 });

    // 10. Stop work confirmation & Clock out
    await page.getByTestId("clock-out").click();
    await expect(page.getByText("Stop work for today?")).toBeVisible({
      timeout: 5_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/11-stop-work-confirm-modal.png",
      "Stop work for today confirmation modal",
      "Confirmations & Safety",
    );
    await page.getByTestId("clock-out-confirm").click();
    await expect(page.getByText("Done for today")).toBeVisible({
      timeout: 10_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/12-today-done-concluded.png",
      "Today screen after concluding the work day",
      "Today & Attendance",
    );

    // 11. Timeline screen & Manual entry dialog
    await page.getByTestId("nav-timeline").click();
    await expect(page.getByTestId("timeline")).toBeVisible({ timeout: 15_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/13-timeline-view.png",
      "Timeline view displaying chronological activity and breaks",
      "Timeline & History",
    );

    // Open Add activity dialog
    await page.getByTestId("add-missing-entry").first().click();
    const entryDialog = page.locator('[role="dialog"]').filter({
      hasText: "Add missing entry",
    });
    await expect(entryDialog).toBeVisible({ timeout: 5_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/14-timeline-add-entry-dialog.png",
      "Timeline modal to manually add missing activity or break",
      "Timeline & History",
    );
    await entryDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(entryDialog).toBeHidden({ timeout: 5_000 });

    // Check split entry modal if available
    const splitButton = page.getByTestId("split-entry-button").first();
    if (await splitButton.isVisible()) {
      await splitButton.click();
      const splitDialog = page.locator('[role="dialog"]').filter({
        hasText: "Split this entry?",
      });
      await expect(splitDialog).toBeVisible({ timeout: 5_000 });
      await takeVisualScreenshot(
        page,
        testInfo,
        "desktop/15-timeline-split-dialog.png",
        "Timeline split activity dialog",
        "Timeline & History",
      );
      await splitDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(splitDialog).toBeHidden({ timeout: 5_000 });
    }

    // 12. Tasks management & Favorites
    await page.getByTestId("nav-tasks").click();
    await expect(page.getByTestId("tasks-list")).toBeVisible({ timeout: 15_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/16-tasks-view.png",
      "Tasks view listing recent tasks with category themes",
      "Tasks & Favorites",
    );

    const favoriteBtn = page.getByTestId("favorite-toggle-0");
    await expect(favoriteBtn).toBeVisible({ timeout: 10_000 });
    await favoriteBtn.click();
    await expect(favoriteBtn).toHaveAttribute("aria-pressed", "true", {
      timeout: 10_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/17-tasks-favorited.png",
      "Tasks view with task starred as favorite",
      "Tasks & Favorites",
    );

    // Wait for server persistence before navigating back to Today
    await expect
      .poll(
        async () => {
          const res = await page.request.get("/api/tasks/recent");
          const tasks = (await res.json()) as { isFavorite: boolean }[];
          return tasks.some((t) => t.isFavorite);
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    await page.getByTestId("nav-today").click();
    await expect(page.getByTestId("quick-start")).toBeVisible({
      timeout: 15_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/18-today-quick-start.png",
      "Today screen featuring Quick Start chips from favorites",
      "Today & Attendance",
    );

    // 13. Reports: Daily Review & Analytics
    await page.getByTestId("nav-reports").click();
    await expect(page.getByTestId("review-attendance")).toBeVisible({
      timeout: 15_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/19-reports-daily-review.png",
      "Daily Review screen showing totals and category breakdown",
      "Reports & Sync",
    );

    // Mark reviewed
    await page.getByTestId("review-submit").click();
    await expect(
      page.locator('[data-slot="badge"]').filter({ hasText: "Reviewed" }),
    ).toBeVisible({ timeout: 10_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/20-reports-reviewed-state.png",
      "Daily Review with Reviewed status badge and sync actions",
      "Reports & Sync",
    );

    // Sync to file dialog
    await page.getByTestId("sync-file-button").click();
    const syncFileDialog = page.locator('[role="dialog"]').filter({
      hasText: "Sync to file",
    });
    await expect(syncFileDialog).toBeVisible({ timeout: 5_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/21-sync-to-file-dialog.png",
      "Sync to file modal dialog for manual spreadsheet export",
      "Reports & Sync",
    );
    await syncFileDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(syncFileDialog).toBeHidden({ timeout: 5_000 });

    // Weekly summary report
    await page.getByTestId("week-link").click();
    await expect(page.getByTestId("week-view")).toBeVisible({ timeout: 15_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/22-reports-weekly-summary.png",
      "Weekly report summary with day cards and weekly targets",
      "Reports & Sync",
    );

    // Monthly summary report
    await page.getByTestId("month-link").click();
    await expect(page.getByTestId("month-view")).toBeVisible({ timeout: 15_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/23-reports-monthly-summary.png",
      "Monthly report summary with monthly hours and weekly slices",
      "Reports & Sync",
    );

    // 14. Dashboard Analytics
    await page.getByTestId("nav-dashboard").click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByTestId("dashboard-tabs").first()).toBeVisible({
      timeout: 15_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/24-dashboard-overview-tab.png",
      "Dashboard Overview tab with progress KPI cards",
      "Dashboard Analytics",
    );

    // Daily tab
    await page.getByTestId("tab-daily").click();
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/25-dashboard-daily-tab.png",
      "Dashboard Daily progress section with categories distribution",
      "Dashboard Analytics",
    );

    // Weekly tab
    await page.getByTestId("tab-weekly").click();
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/26-dashboard-weekly-tab.png",
      "Dashboard Weekly progress section and personal report table",
      "Dashboard Analytics",
    );

    // Monthly tab
    await page.getByTestId("tab-monthly").click();
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/27-dashboard-monthly-tab.png",
      "Dashboard Monthly progress breakdown by week slices",
      "Dashboard Analytics",
    );

    // 15. Settings & Integrations
    await page.getByTestId("nav-settings").click();
    await expect(page.getByTestId("settings-spreadsheet-id")).toBeVisible({
      timeout: 30_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/28-settings-view.png",
      "Settings screen with Google Sheets mappings and Calendar sync",
      "Settings & Integrations",
    );

    // 16. Keyboard Shortcuts Help Dialog
    await page.keyboard.press("?");
    await expect(page.getByTestId("keyboard-help-dialog")).toBeVisible({
      timeout: 5_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/29-keyboard-shortcuts-dialog.png",
      "Keyboard shortcuts modal dialog (? key)",
      "Shortcuts & Accessibility",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("keyboard-help-dialog")).toBeHidden({
      timeout: 5_000,
    });

    // 17. Offline Resilience Banner
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByTestId("offline-banner")).toBeVisible({
      timeout: 5_000,
    });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/30-offline-banner.png",
      "Offline banner signaling connection loss with state preservation",
      "Resilience & Network",
    );
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText("Back online!")).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(500);

    // 18. User Sign Out
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await takeVisualScreenshot(
      page,
      testInfo,
      "desktop/31-sign-out-return-to-login.png",
      "Sign out transition successfully returning user to login screen",
      "Authentication & Onboarding",
    );
  });
});
