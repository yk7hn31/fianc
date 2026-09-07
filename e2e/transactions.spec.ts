import { test, expect, type Locator, type Page } from "@playwright/test";
import { signUp, addAccount } from "./helpers";

/**
 * The list and the table render the same rows in two DOM shapes, and CSS hides
 * one of them — so a plain `getByText` matches twice and trips strict mode.
 * Filtering to what is actually on screen keeps one spec honest on both
 * projects, and asserting on the whole row proves the amount belongs to that
 * transaction rather than merely appearing somewhere on the page.
 */
function visibleRow(page: Page, text: string): Locator {
  return page
    .locator("main")
    .locator("li, tr")
    .filter({ hasText: text })
    .filter({ visible: true });
}

/**
 * One account's card on /accounts, located by its name and nothing else.
 *
 * `filter({ hasText: "Checking" })` would match every card: `hasText` is a
 * case-insensitive substring, and the account *type* line reads "checking" on
 * a card named Savings too. An exact, case-sensitive match on the name
 * paragraph is what separates them.
 */
function accountCard(page: Page, name: string): Locator {
  return page
    .locator("main li")
    .filter({ has: page.getByText(name, { exact: true }) });
}

/**
 * Desktop puts a button above the list, mobile a floating one over it. Both
 * are in the DOM at every width; `getByRole` skips the one CSS has hidden from
 * the accessibility tree.
 */
async function openForm(page: Page) {
  await page
    .getByRole("button", { name: /New transaction|Add transaction/ })
    .click();
  await page.getByLabel("Amount").waitFor();
}

/**
 * Submits and waits for the round trip to land, by the one signal that cannot
 * fire early: the dialog closes only once the action has returned `ok` and
 * React has applied the revalidated payload, so the new row is already in the
 * DOM when this resolves.
 *
 * Without it every assertion below raced the server action, and the whole
 * budget for signup + insert + revalidate + re-render had to fit inside one
 * 5s `expect` timeout — which it does alone and does not with both projects
 * hitting a hosted database at once. Splitting the wait in two gives each
 * step its own budget instead of raising either.
 */
async function save(page: Page) {
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.locator("#amount")).toHaveCount(0);
}

test("add an expense and see it in the list", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "500");
  await page.goto("/transactions");

  // The page renders the form twice, once per trigger. Both instances share
  // the same element ids, so this is the proof that ResponsiveDialog mounts
  // its children only while open and the ids never coexist.
  await expect(page.locator("#amount")).toHaveCount(0);
  await openForm(page);
  await expect(page.locator("#amount")).toHaveCount(1);

  await page.getByLabel("Amount").fill("12.34");
  await page.getByLabel("Payee").fill("Corner Store");
  await save(page);

  const row = visibleRow(page, "Corner Store");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Checking");
  // Signed, and signed the right way: an expense leaves the account.
  await expect(row).toContainText("−$12.34");

  // Balances are a sum over transactions, so the row has to move the account.
  await page.goto("/accounts");
  await expect(
    accountCard(page, "Checking").getByText("$487.66", { exact: true }),
  ).toBeVisible();
});

test("switching the type tab re-picks the category", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "0");
  await page.goto("/transactions");
  await openForm(page);

  // Seeded defaults: the first expense category is Dining, the only income one
  // is Salary. Leaving the Select on a stale expense id would file this income
  // row under Dining — createTransaction deliberately does not police the kind.
  await expect(page.getByLabel("Category")).toContainText("Dining");
  await page.getByRole("tab", { name: "Income" }).click();
  await expect(page.getByLabel("Category")).toContainText("Salary");

  await page.getByLabel("Amount").fill("2000");
  await save(page);

  const row = visibleRow(page, "Salary");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("+$2,000.00");
});

test("a transfer moves money between accounts and nets to zero", async ({
  page,
}) => {
  await signUp(page);
  await addAccount(page, "Checking", "500");
  await addAccount(page, "Savings", "0");

  await page.goto("/transactions");
  await openForm(page);
  await page.getByRole("tab", { name: "Transfer" }).click();
  await page.getByLabel("Amount").fill("100");
  await page.getByLabel("From account").click();
  await page.getByRole("option", { name: "Checking" }).click();
  await page.getByLabel("To account").click();
  await page.getByRole("option", { name: "Savings" }).click();
  await save(page);

  /*
   * Every assertion below is written against a specific way of getting this
   * wrong: writing both legs as `direction: -1`, which destroys the money
   * instead of moving it and leaves Savings at −$100.
   *
   * A row count alone waves that through — there are still two rows. So does
   * `getByText("$100.00")`, because a string argument matches a
   * case-insensitive *substring*: "−$100.00" contains "$100.00", one element
   * matches, and the assertion passes on a ledger that has just eaten a
   * hundred dollars. Hence `exact: true`, each balance read out of its own
   * account's card, and — the part that pins the model itself — a check that
   * the two legs carry opposite signs rather than merely existing.
   */
  const legs = visibleRow(page, "Transfer");
  await expect(legs).toHaveCount(2);
  await expect(legs.filter({ hasText: "−$100.00" })).toHaveCount(1);
  await expect(legs.filter({ hasText: "+$100.00" })).toHaveCount(1);

  await page.goto("/accounts");
  await expect(
    accountCard(page, "Checking").getByText("$400.00", { exact: true }),
  ).toBeVisible();
  await expect(
    accountCard(page, "Savings").getByText("$100.00", { exact: true }),
  ).toBeVisible();
});

test("a bad amount is rejected with the reason on the field", async ({
  page,
}) => {
  await signUp(page);
  await addAccount(page, "Checking", "0");
  await page.goto("/transactions");
  await openForm(page);

  // USD has 2 decimal places; 3 decimals is invalid input.
  await page.getByLabel("Amount").fill("9.999");
  await page.getByLabel("Payee").fill("Rejected Row");
  await page.getByRole("button", { name: "Save transaction" }).click();

  await expect(page.getByText("Check the form")).toBeVisible();
  const fieldError = page.locator("#amount-error");
  await expect(fieldError).toBeVisible();
  await expect(fieldError).not.toBeEmpty();
  await expect(page.getByLabel("Amount")).toHaveAttribute(
    "aria-describedby",
    "amount-error",
  );
  await expect(visibleRow(page, "Rejected Row")).toHaveCount(0);
});

test("with no accounts the page says so instead of offering a dead form", async ({
  page,
}) => {
  await signUp(page);
  await page.goto("/transactions");

  await expect(page.getByText("No accounts yet")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /New transaction|Add transaction/ }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Add an account" }).click();
  await expect(page).toHaveURL(/\/accounts/);
});
