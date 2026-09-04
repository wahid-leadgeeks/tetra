import { expect, test } from "@playwright/test";
import { uniqueEmail } from "./helpers";

test("phase 5 wave 2: keyboard nav, today shortcuts, sticky bar, monthly summary", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByTestId("login-email").fill(uniqueEmail());
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("nav-today")).toBeVisible({ timeout: 15_000 });

  // Global navigation keys 1–5.
  await page.keyboard.press("2");
  await expect(page).toHaveURL(/\/timeline/);
  await page.keyboard.press("1");
  await expect(page).toHaveURL(/\/$/);

  // Help dialog on "?".
  await page.keyboard.press("?");
  await expect(page.getByTestId("keyboard-help-dialog")).toBeVisible({
    timeout: 10_000,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("keyboard-help-dialog")).toBeHidden({
    timeout: 10_000,
  });

  // Typing guard: digit keys typed into an input must not navigate.
  await page.keyboard.press("5");
  await expect(page).toHaveURL(/\/settings/);
  await page.getByTestId("settings-spreadsheet-id").click();
  await page.keyboard.type("123");
  await page.keyboard.press("1");
  await expect(page).toHaveURL(/\/settings/);
  // Blurred, the same key navigates again.
  await page.locator("h1").click();
  await page.keyboard.press("1");
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press("s");
  await expect(page.getByTestId("break-start")).toBeVisible({
    timeout: 10_000,
  });

  // "s" again opens the start-task dialog.
  await page.keyboard.press("s");
  const dialog = page
    .locator('[role="dialog"]')
    .filter({ has: page.getByTestId("category-select") });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByTestId("category-select").click();
  await page.getByRole("option", { name: "Research" }).click();
  await dialog.getByTestId("task-name-input").fill("Wave 2 E2E");
  await dialog.getByTestId("start-task").click();
  await expect(page.getByTestId("active-timer")).toBeVisible({
    timeout: 10_000,
  });

  // Space pauses and resumes the running task. Pressed immediately after the
  // dialog close on purpose: the dialog's exit animation must not swallow
  // the key (regression test for the shared shortcut guard).
  await page.keyboard.press(" ");
  await expect(page.getByTestId("resume-task")).toBeVisible({
    timeout: 10_000,
  });
  await page.keyboard.press(" ");
  await expect(page.getByTestId("pause-task")).toBeVisible({
    timeout: 10_000,
  });

  // "b" toggles the break.
  await page.keyboard.press("b");
  await expect(page.getByTestId("break-end")).toBeVisible({
    timeout: 10_000,
  });
  await page.keyboard.press("b");
  await expect(page.getByTestId("break-start")).toBeVisible({
    timeout: 10_000,
  });

  // Sticky active-task bar on mobile; stops from the bar.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("sticky-timer")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByTestId("sticky-stop").click();
  await expect(page.getByTestId("sticky-timer")).toBeHidden({
    timeout: 10_000,
  });

  // Wrap up the day and reach the monthly summary through the week page.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId("clock-out").click();
  await page.getByTestId("clock-out-confirm").click();
  await expect(page.getByText("Done for today")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByTestId("nav-reports").click();
  await expect(page.getByTestId("review-attendance")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId("week-link").click();
  await expect(page.getByTestId("week-view")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId("month-link").click();
  await expect(page.getByTestId("month-view")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("month-total-work")).toBeVisible();
  await expect(page).toHaveURL(/\/reports\/month/);
  await page.getByTestId("month-prev").click();
  await expect(page.getByTestId("month-view")).toBeVisible({
    timeout: 15_000,
  });
});
