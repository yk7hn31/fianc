import { test, expect } from "@playwright/test";
import { signUp, addAccount, addExpense } from "./helpers";

test("setting a budget shows spend against it", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "40.00", "Market");

  await page.goto("/budgets");
  await page.getByLabel("Groceries budget").fill("100.00");
  await page.getByLabel("Groceries budget").blur();

  await expect(page.getByText("of $100.00")).toBeVisible();
});

test("overspending shows in the destructive colour", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "150.00", "Market");

  await page.goto("/budgets");
  await page.getByLabel("Groceries budget").fill("100.00");
  await page.getByLabel("Groceries budget").blur();

  const line = page.getByText("$150.00 of $100.00");
  await expect(line).toBeVisible();
  await expect(line).toHaveCSS("color", "rgb(231, 0, 11)");
});
