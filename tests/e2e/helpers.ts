import { expect, type Page } from "@playwright/test";

let counter = 0;

/** Unique email per test so DB rows are isolated across runs. */
export function uniqueEmail(): string {
  counter += 1;
  const stamp = Date.now().toString(36);
  return `e2e-${stamp}-${counter}@tetra.local`;
}

/** Sign in through the dev login form and land on the Today screen. */
export async function login(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByTestId("login-email").fill(uniqueEmail());
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("nav-today")).toBeVisible({ timeout: 15_000 });
}

/** Assert a sonner toast with the given title is visible. */
export async function expectToast(page: Page, text: string): Promise<void> {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text })).toBeVisible({
    timeout: 10_000,
  });
}
