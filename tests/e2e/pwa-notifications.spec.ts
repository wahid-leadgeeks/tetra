import { expect, test } from "@playwright/test";
import { uniqueEmail } from "./helpers";

test.describe("Progressive Web App (PWA) & Notifications", () => {
  test("serves valid Web App Manifest, Service Worker, and Offline shell", async ({
    request,
  }) => {
    // 1. Verify Manifest
    const manifestRes = await request.get("/manifest.webmanifest");
    expect(manifestRes.ok()).toBe(true);
    const manifest = await manifestRes.json();
    expect(manifest.name).toBe("TETRA — Employee Task & Time Tracking Companion");
    expect(manifest.short_name).toBe("TETRA");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    // 2. Verify Service Worker
    const swRes = await request.get("/sw.js");
    expect(swRes.ok()).toBe(true);
    const swContent = await swRes.text();
    expect(swContent).toContain("tetra-pwa-v1");
    expect(swContent).toContain("notificationclick");

    // 3. Verify Offline Shell
    const offlineRes = await request.get("/offline.html");
    expect(offlineRes.ok()).toBe(true);
    const offlineContent = await offlineRes.text();
    expect(offlineContent).toContain("Connection Offline");
  });

  test("renders Notifications & Companion App controls in settings", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await page.getByTestId("login-email").fill(uniqueEmail());
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("nav-today")).toBeVisible({ timeout: 15_000 });

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/, { timeout: 15_000 });

    // Notifications & Companion card is visible
    const notifCard = page.getByTestId("notifications-settings-card");
    await expect(notifCard).toBeVisible({ timeout: 10_000 });
    await expect(notifCard).toContainText("Notifications & Companion App");
    await expect(notifCard).toContainText("Desktop & Mobile Notifications");
    await expect(notifCard).toContainText("Progressive Web App (PWA)");

    // Test alert button exists
    const testAlertBtn = page.getByTestId("send-test-notification-btn");
    await expect(testAlertBtn).toBeVisible();
  });
});
