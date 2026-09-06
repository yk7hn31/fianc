import { test, expect } from "@playwright/test";

const code = process.env.SIGNUP_CODE ?? "change-me";

function uniqueEmail() {
  return `e2e+${Date.now()}${Math.random().toString(36).slice(2, 7)}@example.com`;
}

test("signup with the code lands on the dashboard", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("a-long-enough-password");
  await page.getByLabel("Signup code").fill(code);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("signup without the right code is rejected", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("a-long-enough-password");
  await page.getByLabel("Signup code").fill("wrong-code");
  await page.getByRole("button", { name: "Create account" }).click();
  // Next's App Router always mounts a hidden `role="alert"` route announcer
  // (in an open shadow root, for screen-reader navigation announcements),
  // so a bare getByRole("alert") matches two elements. Filter to the one
  // that actually carries our message rather than weakening the assertion.
  await expect(
    page.getByRole("alert").filter({ hasText: "signup code" }),
  ).toContainText("signup code");
});

test("a signed-out visitor is redirected to login", async ({ page }) => {
  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/login/);
});

test("login then logout", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-long-enough-password");
  await page.getByLabel("Signup code").fill(code);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-long-enough-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
