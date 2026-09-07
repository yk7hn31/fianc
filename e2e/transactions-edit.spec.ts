import { test, expect } from "@playwright/test";
import { signUp, addAccount, addExpense } from "./helpers";

/**
 * The mobile list and the desktop table render the same row in two DOM
 * shapes at once — CSS hides one of them, it is never unmounted — so a bare
 * `getByText` always resolves to both and trips strict mode on either
 * project. See the identical note on `visibleRow` in transactions.spec.ts.
 */
function visible(page: import("@playwright/test").Page, text: string) {
  return page.getByText(text).filter({ visible: true });
}

test("edit a transaction's amount", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "10.00", "Bakery");

  await page.getByRole("button", { name: /Actions for Bakery|More/ }).first().click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByLabel("Amount").fill("15.00");
  await page.getByRole("button", { name: /Save/ }).click();

  await expect(visible(page, "$15.00")).toBeVisible();
  await expect(visible(page, "$10.00")).toBeHidden();
});

test("filter by search text", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "10.00", "Bakery");
  await addExpense(page, "20.00", "Hardware");

  await page.goto("/transactions");
  await page.getByLabel("Search").fill("Bakery");
  await page.getByLabel("Search").press("Enter");

  await expect(visible(page, "Bakery")).toBeVisible();
  await expect(visible(page, "Hardware")).toBeHidden();
});

test("deleting one half of a transfer deletes both", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "500");
  await addAccount(page, "Savings", "0");

  await page.goto("/transactions");
  await page.getByRole("button", { name: /New transaction|Add transaction/ }).click();
  await page.getByRole("tab", { name: "Transfer" }).click();
  await page.getByLabel("Amount").fill("100");
  await page.getByLabel("From account").click();
  await page.getByRole("option", { name: "Checking" }).click();
  await page.getByLabel("To account").click();
  await page.getByRole("option", { name: "Savings" }).click();
  await page.getByRole("button", { name: "Save transaction" }).click();

  await page.getByRole("button", { name: /Actions|More/ }).first().click();
  await page.getByRole("menuitem", { name: "Delete" }).click();

  await expect(page.getByText("No transactions yet.")).toBeVisible();
  await page.goto("/accounts");
  await expect(page.getByText("$500.00")).toBeVisible();
});
