import { test, expect } from "@playwright/test";
import { signUp, addAccount, addExpense } from "./helpers";

test("the dashboard reflects a new expense without a reload", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "25.00", "Coffee");

  await page.goto("/dashboard");
  await expect(page.getByText("Expense")).toBeVisible();
  await expect(page.getByText("$25.00").first()).toBeVisible();
  // Not a plain `getByText("Coffee")`: the Recent section renders the same
  // row in a mobile list and a desktop table simultaneously (CSS hides one),
  // so an unfiltered match is never unique. See the same note on `addExpense`
  // in e2e/helpers.ts.
  await expect(page.getByText("Coffee").filter({ visible: true })).toBeVisible();
});
