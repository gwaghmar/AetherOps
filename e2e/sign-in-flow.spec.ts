import { expect, test } from "@playwright/test";

test.describe("Sign in flow", () => {
  test("sign up, sign out, sign in again", async ({ page }) => {
    const ts = Date.now();
    const email = `signin-${ts}@example.com`;
    const password = "signin-test-pass-ok-99!";
    const name = "Signin Tester";

    // --- Sign up ---
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();

    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign up" }).click();

    // Either email confirmation required or direct login
    await Promise.race([
      page.waitForURL(/\/home/, { timeout: 45_000 }),
      expect(page.getByText("Check your inbox")).toBeVisible({ timeout: 45_000 }),
    ]);

    // Skip sign-out / sign-in cycle if email confirmation is required
    if (!page.url().includes("/home")) {
      test.skip();
      return;
    }

    // --- Sign out ---
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/sign-in/, { timeout: 15_000 });

    // --- Sign in ---
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Continue with email" }).click();

    await page.waitForURL(/\/home/, { timeout: 45_000 });
  });
});
