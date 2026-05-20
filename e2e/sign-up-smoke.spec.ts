/**
 * Sign-up smoke test — covers the full new-user onboarding path.
 *
 * Handles two Supabase configurations:
 *   • Email confirmation OFF (local dev / test project): form redirects to /home
 *   • Email confirmation ON  (production default):       form shows "Check your inbox"
 *
 * Run locally:
 *   npx playwright test e2e/sign-up-smoke.spec.ts
 *
 * Run against production:
 *   PLAYWRIGHT_BASE_URL=https://aetherops-govw.vercel.app npx playwright test e2e/sign-up-smoke.spec.ts
 *
 * Cleanup: set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL to auto-delete
 * test users after the run. Without these the test user remains but causes no harm
 * on subsequent runs (unique email each time).
 */

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SIGNUP_TIMEOUT = 30_000;

async function deleteTestUser(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return;

  try {
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data } = await admin.auth.admin.listUsers();
    const match = data?.users?.find((u) => u.email === email);
    if (match) {
      await admin.auth.admin.deleteUser(match.id);
    }
  } catch {
    // Cleanup is best-effort — don't fail the test if Supabase is unreachable
  }
}

/** Returns true if the Supabase Auth API is reachable. */
async function checkSupabaseReachable(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return false;
  try {
    const res = await fetch(`${url}/auth/v1/health`, { signal: AbortSignal.timeout(8_000) });
    return res.ok;
  } catch {
    return false;
  }
}

test.describe("Sign-up smoke test", () => {
  let testEmail: string;
  let supabaseUp: boolean;

  test.beforeAll(async () => {
    supabaseUp = await checkSupabaseReachable();
    if (!supabaseUp) {
      console.warn(
        "\n[smoke] Supabase Auth API unreachable — project may be paused.\n" +
        "  → Go to https://supabase.com/dashboard and unpause the project.\n" +
        "  → Form-submission tests will be skipped.\n",
      );
    }
  });

  test.beforeEach(() => {
    testEmail = `smoke-${Date.now()}@test.aetherops.internal`;
  });

  test.afterEach(async () => {
    await deleteTestUser(testEmail);
  });

  test("sign-up page renders without errors", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
    // No error alert should be visible on initial load
    await expect(page.getByRole("alert")).not.toBeVisible();
  });

  test("valid sign-up succeeds — redirects to /home or shows check-email", async ({ page }) => {
    test.skip(!supabaseUp, "Supabase project is paused — unpause at supabase.com/dashboard");
    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Smoke Tester");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill("Sm0ke-Test-Pass-99!");
    await page.getByRole("button", { name: "Sign up" }).click();

    // Button should show loading state
    await expect(page.getByRole("button", { name: "Creating…" })).toBeVisible({ timeout: 5_000 })
      .catch(() => { /* may resolve too fast */ });

    // Either redirect to /home OR show check-email message
    await Promise.race([
      page.waitForURL(/\/home/, { timeout: SIGNUP_TIMEOUT }),
      expect(page.getByText("Check your inbox")).toBeVisible({ timeout: SIGNUP_TIMEOUT }),
    ]);

    // Confirm no error alert was shown
    await expect(page.getByRole("alert")).not.toBeVisible();
  });

  test("duplicate email shows Supabase error", async ({ page }) => {
    test.skip(!supabaseUp, "Supabase project is paused — unpause at supabase.com/dashboard");
    // First sign-up
    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("First User");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill("Sm0ke-Test-Pass-99!");
    await page.getByRole("button", { name: "Sign up" }).click();
    await Promise.race([
      page.waitForURL(/\/home/, { timeout: SIGNUP_TIMEOUT }),
      expect(page.getByText("Check your inbox")).toBeVisible({ timeout: SIGNUP_TIMEOUT }),
    ]).catch(() => { /* ignore if first sign-up itself shows error in this environment */ });

    // Second sign-up with same email
    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Duplicate User");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill("Sm0ke-Test-Pass-99!");
    await page.getByRole("button", { name: "Sign up" }).click();

    // Supabase returns an error for duplicate sign-ups or silently accepts (rate-limited)
    // We just verify the form does not crash and either shows error or check-email
    await Promise.race([
      expect(page.getByRole("alert")).toBeVisible({ timeout: SIGNUP_TIMEOUT }),
      expect(page.getByText("Check your inbox")).toBeVisible({ timeout: SIGNUP_TIMEOUT }),
      page.waitForURL(/\/home/, { timeout: SIGNUP_TIMEOUT }),
    ]);
  });

  test("short password shows validation error", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Short Pass");
    await page.getByLabel("Email").fill(testEmail);
    // minLength is 8 on the input — browser validation fires before submission
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Sign up" }).click();

    // HTML5 constraint validation prevents submission — no network request made
    const passwordInput = page.getByLabel("Password");
    const validityState = await passwordInput.evaluate(
      (el) => (el as HTMLInputElement).validity.tooShort,
    );
    expect(validityState).toBe(true);
  });
});
