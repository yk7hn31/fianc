import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

test("a new account is seeded with default categories", async ({ page }) => {
  await signUp(page);
  await page.goto("/categories");
  await expect(page.getByText("Groceries")).toBeVisible();
  await expect(page.getByText("Salary")).toBeVisible();
});

test("add a category", async ({ page }) => {
  await signUp(page);
  await page.goto("/categories");
  await page.getByRole("button", { name: "New category" }).click();
  await page.getByLabel("Name").fill("Gifts");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByText("Gifts")).toBeVisible();
});

test("a non-default icon and kind are actually submitted", async ({
  page,
}) => {
  await signUp(page);
  await page.goto("/categories");
  await page.getByRole("button", { name: "New category" }).click();
  await page.getByLabel("Name").fill("Side Hustle");
  await page.getByLabel("Kind").click();
  await page.getByRole("option", { name: "Income" }).click();
  await page.getByRole("button", { name: "Gift" }).click();
  await page.getByRole("button", { name: "Add category" }).click();

  // Grouped under Income, not the default Expense group — this is what
  // catches a Base UI Select whose value never reaches the submitted
  // FormData (the row would otherwise save with the default "expense" kind).
  const incomeGroup = page.getByText("Income", { exact: true }).locator("..");
  const expenseGroup = page.getByText("Expense", { exact: true }).locator("..");
  await expect(incomeGroup.getByText("Side Hustle")).toBeVisible();
  await expect(expenseGroup.getByText("Side Hustle")).not.toBeVisible();

  const row = page.locator("li", { hasText: "Side Hustle" });
  await expect(row).toBeVisible();
  // The icon picker's value has to reach the server too, not just default
  // to "Circle" silently.
  await expect(row.locator("svg.lucide-gift")).toBeVisible();
});
