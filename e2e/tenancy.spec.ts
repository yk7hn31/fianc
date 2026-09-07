import { test, expect } from "@playwright/test";
import { signUp, addAccount, addExpense } from "./helpers";

/**
 * Every read model in `lib/queries/*` takes `userId` as its first argument and
 * is expected to scope on it, but until now nothing above the query builder's
 * own unit tests would notice if one stopped. Six read models — accounts,
 * transactions, spend-by-category, month totals, categories and budgets —
 * feed five pages, and each is a place a missing `eq(table.userId, userId)`
 * would put one household's money in front of another's.
 *
 * One signed-out/signed-in pass over the whole app is what covers all of
 * them at once: user A fills a ledger, user B signs up on the same browser,
 * and every page B can reach must be empty. Assertions are on B's screens
 * rather than on A's, because a leak shows up as something *extra* appearing,
 * which `toHaveCount(0)` catches and a positive assertion about A's own data
 * never would.
 */
test("a second user sees none of the first user's data", async ({ page }) => {
  // Two full signups (an argon2 hash each), a ledger built through the UI and
  // then five pages re-read as a different user. That is genuinely more work
  // than the 30s default allows on a dev server — not a flaky wait: nothing
  // here polls for something that may never arrive, and every assertion below
  // keeps its own default 5s.
  test.slow();

  // --- user A: a ledger with one of everything ---------------------------
  await signUp(page);
  await addAccount(page, "Alpha Checking", "1234.00");
  await addExpense(page, "40.00", "Alpha Bakery");

  await page.goto("/categories");
  await page.getByRole("button", { name: "New category" }).click();
  await page.getByLabel("Name").fill("Alpha Only");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByText("Alpha Only")).toBeVisible();

  await page.goto("/budgets");
  await page.getByLabel("Groceries budget").fill("100.00");
  await page.getByLabel("Groceries budget").blur();
  // Waiting for A's own budget to land before signing out: the save is a
  // server action fired on blur, and navigating away first would abort it and
  // leave nothing for B's page to leak.
  await expect(page.getByText("$40.00 of $100.00")).toBeVisible();

  // --- user B: a brand new account in the same browser -------------------
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await signUp(page);
  // B needs an account of its own before /transactions will show a ledger at
  // all — with none the page renders "No accounts yet" instead of the list,
  // which would pass the empty-ledger assertion below for the wrong reason.
  await addAccount(page, "Beta Checking", "5.00");

  // listAccountsWithBalance / listActiveAccounts.
  await page.goto("/accounts");
  await expect(page.getByText("Beta Checking")).toBeVisible();
  await expect(page.getByText("Alpha Checking")).toHaveCount(0);
  await expect(page.getByText("$1,234.00")).toHaveCount(0);

  // listTransactions (buildTxWhere). B's ledger is empty, so the empty state
  // is the assertion — if A's row leaked, the list would render instead.
  await page.goto("/transactions");
  await expect(page.getByText("No transactions yet.")).toBeVisible();
  await expect(page.getByText("Alpha Bakery")).toHaveCount(0);

  // listCategories. B gets the same seeded defaults, so "Groceries" is
  // present for B too — "Alpha Only" is the category that can only have come
  // from A.
  await page.goto("/categories");
  await expect(page.getByText("Groceries", { exact: true })).toBeVisible();
  await expect(page.getByText("Alpha Only")).toHaveCount(0);

  // getBudgetMonth. B's own Groceries row must be unbudgeted and unspent:
  // A's $100 cap and $40 of spend must not appear against it.
  await page.goto("/budgets");
  const groceries = page.locator("main li").filter({ hasText: "Groceries" });
  await expect(groceries.getByLabel("Groceries budget")).toHaveValue("");
  await expect(groceries.getByText("$0.00 of $0.00")).toBeVisible();
  await expect(page.getByText("of $100.00")).toHaveCount(0);

  // monthTotals and spendByCategory. Zero income and zero expense, and the
  // donut's empty state rather than a chart — a chart at all would mean
  // A's expense reached B's breakdown.
  await page.goto("/dashboard");
  await expect(page.getByText("No spending this month.")).toBeVisible();
  await expect(page.getByText("$40.00")).toHaveCount(0);
  await expect(page.getByText("Alpha Bakery")).toHaveCount(0);
  // The stat block is a label paragraph above a value paragraph, so the
  // value is the label's next sibling — scoping this way is what keeps
  // "$0.00" from matching some other zero elsewhere on the page.
  for (const label of ["Income", "Expense", "Net"]) {
    await expect(
      page.getByText(label, { exact: true }).locator("xpath=following-sibling::p[1]"),
    ).toHaveText("$0.00");
  }
});
