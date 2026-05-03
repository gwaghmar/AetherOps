import { expect, test } from "@playwright/test";

test.describe("Sign in flow", () => {
  test("sign up, sign out, sign in again", async ({ page }) => {

    const ts = Date.now();
    const email = `signin-${ts}@example.com`;
    const password = "signin-test-pass-ok-99!";
    const name = "Signin Tester";

    await page.goto("/sign-up");
    await expect(
      page.getByRole("heading", { name: "Create account" }),
    ).toBeVisible();

    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign up" }).click();

    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({
      timeout: 45_000,
    });

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/sign-in/, { timeout: 15_000 });

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({
      timeout: 45_000,
    });
  });
});
