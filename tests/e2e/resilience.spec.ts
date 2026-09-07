import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("Resilience, Confirmations & Network Recovery", () => {
  test("end-to-end: confirmations for stop work/task, tab reload recovery, and offline mode", async ({
    page,
    context,
  }) => {
    // 1. Login with isolated dev user
    await login(page);
    await expect(page.getByTestId("clock-in")).toBeVisible();

    // 2. Start work day
    await page.getByTestId("clock-in").click();
    await expect(page.getByTestId("clock-out")).toBeVisible({ timeout: 10_000 });

    // 3. Test Stop Work Confirmation: CANCEL path
    await page.getByTestId("clock-out").click();
    await expect(page.getByText("Stop work for today?")).toBeVisible({
      timeout: 5_000,
    });
    // Click Cancel in modal
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Stop work for today?")).toBeHidden({
      timeout: 5_000,
    });
    // Verify work is still active
    await expect(page.getByTestId("clock-out")).toBeVisible();
    await expect(page.getByText("Done for today")).toBeHidden();

    // 4. Start a task
    await page.getByTestId("log-activity").click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("category-select").click();
    await page.getByRole("option", { name: "Research" }).click();
    await dialog.getByTestId("task-name-input").fill("Resilience Safety Task");
    await dialog.getByTestId("start-task").click();

    await expect(page.getByTestId("active-timer")).toBeVisible({
      timeout: 10_000,
    });

    // 5. Test Stop Task Confirmation: CANCEL path
    await page.getByTestId("stop-task").click();
    await expect(page.getByText("Stop current task?")).toBeVisible({
      timeout: 5_000,
    });
    await expect(
      page.getByRole("dialog").getByText("Resilience Safety Task"),
    ).toBeVisible();
    // Click Cancel in modal
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Stop current task?")).toBeHidden({
      timeout: 5_000,
    });
    // Verify task timer is still actively running
    await expect(page.getByTestId("active-timer")).toBeVisible();

    // 6. Test Accidental Tab Close / Reload Mitigation (Server-Authoritative Recovery)
    // Simulate user reloading or re-opening tab while task is active
    await page.reload();
    await expect(page.getByTestId("nav-today")).toBeVisible({ timeout: 15_000 });
    // Verify active task seamlessly rehydrates from PostgreSQL with running timer
    await expect(page.getByTestId("active-timer")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Resilience Safety Task").first()).toBeVisible();

    // 7. Test Stop Task Confirmation: CONFIRM path
    await page.getByTestId("stop-task").click();
    await expect(page.getByText("Stop current task?")).toBeVisible({
      timeout: 5_000,
    });
    await page.getByTestId("stop-task-confirm").click();
    await expect(page.getByTestId("active-timer")).toBeHidden({
      timeout: 10_000,
    });

    // 8. Test Internet Disconnection & Reconnection Mitigation
    await expect(page.getByTestId("offline-banner")).toBeHidden();

    // Simulate browser offline event
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByTestId("offline-banner")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText("Offline mode:")).toBeVisible();

    // Simulate browser online restoration
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText("Back online!")).toBeVisible({
      timeout: 5_000,
    });

    // 9. Test Stop Work Confirmation: CONFIRM path
    await page.getByTestId("clock-out").click();
    await expect(page.getByText("Stop work for today?")).toBeVisible({
      timeout: 5_000,
    });
    await page.getByTestId("clock-out-confirm").click();
    await expect(page.getByText("Done for today")).toBeVisible({
      timeout: 10_000,
    });
  });
});
