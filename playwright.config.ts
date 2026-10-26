import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build and a throwaway database (name ending in _test or _e2e),
 * which tests/e2e/prepare-db.ts fills with the demo data before the run.
 *
 *   pnpm build && DATABASE_URL=…/patmichaels_e2e pnpm test:e2e
 *
 * Set E2E_BASE_URL to test a server that is already running (its database must be prepared the same way).
 */
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm exec next start --port ${port}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: { APP_URL: baseURL, PORT: String(port) },
      },
});
