import type { Page } from "@playwright/test";

const code = process.env.SIGNUP_CODE ?? "change-me";

export async function signUp(page: Page): Promise<string> {
  const email = `e2e+${Date.now()}${Math.random().toString(36).slice(2, 7)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-long-enough-password");
  await page.getByLabel("Signup code").fill(code);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard/);
  return email;
}
