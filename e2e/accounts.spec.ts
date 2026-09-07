import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

test("create an account and see its opening balance", async ({ page }) => {
  await signUp(page);
  await page.goto("/accounts");
  await page.getByRole("button", { name: "New account" }).click();
  await page.getByLabel("Name").fill("Everyday Checking");
  await page.getByLabel("Opening balance").fill("1,250.50");
  await page.getByRole("button", { name: "Add account" }).click();

  await expect(page.getByText("Everyday Checking")).toBeVisible();
  await expect(page.getByText("$1,250.50")).toBeVisible();
});

test("a non-default account type is actually submitted", async ({ page }) => {
  await signUp(page);
  await page.goto("/accounts");
  await page.getByRole("button", { name: "New account" }).click();
  await page.getByLabel("Name").fill("Rainy Day Savings");
  await page.getByLabel("Type").click();
  await page.getByRole("option", { name: "Savings" }).click();
  await page.getByRole("button", { name: "Add account" }).click();

  await expect(page.getByText("Rainy Day Savings")).toBeVisible();
  // The card renders the type in a dedicated line above the name/balance —
  // this is what catches a Base UI Select whose value never reaches the
  // submitted FormData (the row would otherwise save with the default
  // "checking" type despite the user having picked "Savings").
  const card = page.locator("li", { hasText: "Rainy Day Savings" });
  await expect(card.getByText("savings", { exact: true })).toBeVisible();
});

test("a bad opening balance is rejected, not silently saved as zero", async ({
  page,
}) => {
  await signUp(page);
  await page.goto("/accounts");
  await page.getByRole("button", { name: "New account" }).click();
  await page.getByLabel("Name").fill("Bad Balance Test");
  // USD has 2 decimal places; 3 decimals is invalid input.
  await page.getByLabel("Opening balance").fill("12.345");
  await page.getByRole("button", { name: "Add account" }).click();

  // Rejection has to be visible, the specific reason has to reach the user,
  // and the account must not silently land with a balance of zero.
  await expect(page.getByText("Check the form")).toBeVisible();
  const fieldError = page.locator("#openingBalance-error");
  await expect(fieldError).toBeVisible();
  await expect(fieldError).not.toBeEmpty();
  await expect(page.getByLabel("Opening balance")).toHaveAttribute(
    "aria-describedby",
    "openingBalance-error",
  );
  await expect(page.getByText("Bad Balance Test")).not.toBeVisible();
});
