import { test, expect } from "@playwright/test";
import { addAccount, signUp } from "./helpers";

test("switching the base currency relabels existing amounts everywhere", async ({
  page,
}) => {
  await signUp(page);
  await addAccount(page, "Checking", "100");
  await expect(page.getByText("$100.00")).toBeVisible();

  await page.goto("/settings");
  await page.getByLabel("Base currency").click();
  await page.getByRole("option", { name: "Korean won (₩)" }).click();
  await page.getByRole("button", { name: "Save currency" }).click();
  await expect(page.getByText("Currency saved")).toBeVisible();

  // The stored integer never moved: an opening balance of "100" is 10000
  // minor units, which is $100.00 under a two-decimal currency and ₩10,000
  // under a zero-decimal one. This is the relabel-don't-convert decision,
  // asserted on the number the user actually sees.
  await page.goto("/accounts");
  await expect(page.getByText("₩10,000")).toBeVisible();
  await expect(page.getByText("$100.00")).toHaveCount(0);

  // It is the whole app, not one page: the dashboard reads the same setting.
  await page.goto("/dashboard");
  await expect(page.getByText("₩0", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("$0.00")).toHaveCount(0);
});

test("the won refuses the decimals the dollar accepts", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "100");

  await page.goto("/settings");
  await page.getByLabel("Base currency").click();
  await page.getByRole("option", { name: "Korean won (₩)" }).click();
  await page.getByRole("button", { name: "Save currency" }).click();
  await expect(page.getByText("Currency saved")).toBeVisible();

  // parseAmount derives its fraction bound from the currency, so the form
  // that took "12.34" a moment ago now rejects it on the field rather than
  // silently truncating someone's money.
  await page.goto("/transactions");
  await page.getByRole("button", { name: /New transaction|Add transaction/ }).click();
  await page.getByLabel("Amount").fill("12.34");
  await page.getByLabel("Payee").fill("Coffee");
  await page.getByRole("button", { name: "Save transaction" }).click();

  await expect(page.locator("#amount-error")).toBeVisible();
});

test("the settings page keeps its currency after a reload", async ({ page }) => {
  await signUp(page);

  await page.goto("/settings");
  await page.getByLabel("Base currency").click();
  await page.getByRole("option", { name: "Korean won (₩)" }).click();
  await page.getByRole("button", { name: "Save currency" }).click();
  await expect(page.getByText("Currency saved")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Base currency")).toHaveText(/Korean won/);
});
