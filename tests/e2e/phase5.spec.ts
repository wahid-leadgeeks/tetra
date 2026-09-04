import { expect, test } from "@playwright/test";
import { uniqueEmail } from "./helpers";

test("phase 5: favorite task → quick start → weekly summary", async ({
  page,
}) => {
  page.on("pageerror", (err) =>
    console.log("PAGEERROR:", String(err).slice(0, 400)),
  );
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log("CONSOLE-ERR:", msg.text().slice(0, 300));
    }
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByTestId("login-email").fill(uniqueEmail());
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("nav-today")).toBeVisible({ timeout: 15_000 });

  // Track once so a task exists to favorite.
  await page.getByTestId("clock-in").click();
  await page.getByTestId("log-activity").waitFor({ timeout: 10_000 });
  await page.getByTestId("log-activity").click();
  const dialog = page
    .locator('[role="dialog"]')
    .filter({ has: page.getByTestId("category-select") });
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("category-select").click();
  await page.getByRole("option", { name: "Research" }).click();
  await dialog.getByTestId("task-name-input").fill("Phase 5 E2E Task");
  await dialog.getByTestId("start-task").click();
  await expect(page.getByTestId("active-timer")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByTestId("stop-task").click();
  await expect(page.getByTestId("active-timer")).toBeHidden({
    timeout: 10_000,
  });

  // Star the task on the Tasks page.
  await page.getByTestId("nav-tasks").click();
  const star = page.getByTestId("favorite-toggle-0");
  await expect(star).toBeVisible({ timeout: 15_000 });
  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true", {
    timeout: 10_000,
  });
  // The star flips optimistically, so wait for server truth before
  // navigating: QuickStart fetches once on mount, and a fetch racing the
  // PATCH would miss the just-starred task.
  await expect
    .poll(async () => {
      const res = await page.request.get("/api/tasks/recent");
      const tasks = (await res.json()) as { isFavorite: boolean }[];
      return tasks.some((task) => task.isFavorite);
    })
    .toBe(true);

  // Quick start chip on Today starts the favorited task.
  await page.getByTestId("nav-today").click();
  const chip = page.getByTestId("quick-start-task-0");
  await expect(page.getByTestId("quick-start")).toBeVisible({
    timeout: 15_000,
  });
  await expect(chip).toContainText("Phase 5 E2E Task");
  await chip.click();
  await expect(page.getByTestId("active-timer")).toBeVisible({
    timeout: 10_000,
  });

  // Weekly summary is reachable from the daily review.
  await page.getByTestId("stop-task").click();
  await expect(page.getByTestId("active-timer")).toBeHidden({
    timeout: 10_000,
  });
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
  await expect(page.getByTestId("week-view")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("week-total-work")).toBeVisible();
  await expect(page).toHaveURL(/\/reports\/week/);
});
