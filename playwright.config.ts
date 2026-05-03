import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(".env.local") });
dotenv.config({ path: path.resolve(".env") });

/** Prefer app auth URL so Playwright’s Origin matches Better Auth `trustedOrigins` (localhost vs 127.0.0.1). */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.BETTER_AUTH_URL?.trim() ||
  "http://127.0.0.1:3000";

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "http://127.0.0.1:3000";
  }
}

/** Must match Playwright `baseURL` so Better Auth cookies and CSRF trust the browser origin. */
const e2ePublicOrigin = originOf(baseURL);

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
if (!hasDb) {
  throw new Error("DATABASE_URL must be provided to run E2E specs. Failing fast.");
}

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      BETTER_AUTH_URL: e2ePublicOrigin,
      NEXT_PUBLIC_APP_URL: e2ePublicOrigin,
    },
  },
});
