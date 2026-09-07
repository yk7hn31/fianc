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

/**
 * Files the expense under Groceries explicitly, rather than leaving the
 * form's default category selection in place: the seeded default categories
 * sort alphabetically within "expense" (Dining, Groceries, Health, ...), so
 * the form's own default is Dining, not Groceries. budgets.spec.ts sets a
 * budget on Groceries and checks the spend line for that same category, so
 * the expense has to actually land there.
 */
export async function addExpense(page: Page, amount: string, payee: string) {
  await page.goto("/transactions");
  await page.getByRole("button", { name: /New transaction|Add transaction/ }).click();
  await page.getByLabel("Amount").fill(amount);
  await page.getByLabel("Category").click();
  await page.getByRole("option", { name: "Groceries" }).click();
  await page.getByLabel("Payee").fill(payee);
  await page.getByRole("button", { name: "Save transaction" }).click();
  // Not a plain `getByText(payee)`: the list and the table render the same
  // row in two DOM shapes and CSS hides one of them (see `visibleRow` in
  // transactions.spec.ts), so an unfiltered match is never unique and
  // `waitFor` throws a strict-mode violation before ever checking visibility.
  await page.getByText(payee).filter({ visible: true }).waitFor();
}

/**
 * The income counterpart of `addExpense`, filed under the one seeded income
 * category (Salary). Switching the type tab is what makes the row an income
 * row — `type` is a hidden field driven by that tab, not by the category.
 */
export async function addIncome(page: Page, amount: string, payee: string) {
  await page.goto("/transactions");
  await page.getByRole("button", { name: /New transaction|Add transaction/ }).click();
  await page.getByRole("tab", { name: "Income" }).click();
  await page.getByLabel("Amount").fill(amount);
  await page.getByLabel("Payee").fill(payee);
  await page.getByRole("button", { name: "Save transaction" }).click();
  await page.getByText(payee).filter({ visible: true }).waitFor();
}
