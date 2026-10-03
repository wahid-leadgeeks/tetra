import { defineConfig, devices } from "@playwright/test";

// Locally, e2e runs against a fresh embedded PGlite database (ADR-0008), never
// the DATABASE_URL in .env.local, which may point at a shared remote Postgres.
// Process env takes precedence over .env.local for both Next.js and tsx.
// CI keeps its own throwaway Postgres service (see .github/workflows/ci.yml).
const E2E_PGLITE_DIR = ".data/e2e-pglite";

const localWebServer = {
  command: `rm -rf ${E2E_PGLITE_DIR} && pnpm db:migrate && pnpm db:seed && pnpm dev`,
  env: { DATABASE_URL: `file:${E2E_PGLITE_DIR}` },
  // Never reuse an already running dev server: it may be connected to the
  // remote database. If port 3000 is busy, Playwright fails instead.
  reuseExistingServer: false,
};

const ciWebServer = {
  command: "pnpm start",
  reuseExistingServer: false,
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/playwright-results.json" }],
  ],
  timeout: 180_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    ...(process.env.CI ? ciWebServer : localWebServer),
    url: "http://localhost:3000",
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
});
