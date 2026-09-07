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

/**
 * A transaction needs somewhere to land, so most specs here start by creating
 * an account. Waiting for the name to appear is what makes this composable:
 * the server action revalidates and the list re-renders, and returning before
 * that lands would have the next step navigate away mid-flight.
 */
export async function addAccount(
  page: Page,
  name: string,
  opening: string,
): Promise<void> {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "New account" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Opening balance").fill(opening);
  await page.getByRole("button", { name: "Add account" }).click();
  // The card in the list, not `getByText(name)`: that matches case-insensitively
  // and substring-wise, so the still-open dialog's own fields satisfy it — it
  // resolves instantly and the next navigation aborts the action mid-flight.
  await page.locator("main li").filter({ hasText: name }).waitFor();
}
