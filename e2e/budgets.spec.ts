import { test, expect, type Locator, type Page } from "@playwright/test";
import { signUp, addAccount, addExpense } from "./helpers";

/** The Groceries row, scoped so its "Rollover" switch isn't ambiguous with
 * every other category's identically-labelled switch on the same page. */
function groceriesRow(page: Page): Locator {
  return page.locator("main li").filter({ hasText: "Groceries" });
}

/**
 * The month key the budgets page defaults to, and its neighbours.
 *
 * UTC, because that is what `monthKey(new Date())` in lib/budgets.ts uses to
 * pick the default month — deriving it locally here would disagree with the
 * page for the last hours of the month west of Greenwich.
 */
function monthOffset(n: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + n, 1));
  return d.toISOString().slice(0, 7);
}

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

test("rollover carries a category's remaining balance into the next month", async ({
  page,
}) => {
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "40.00", "Market");

  await page.goto("/budgets");
  const thisMonth = groceriesRow(page);
  await thisMonth.getByLabel("Groceries budget").fill("100.00");
  // Clicking the switch blurs the Input first (queuing a save of the typed
  // amount) and then fires its own save (queuing the rollover flag) — the
  // exact race from the budget-row.tsx fix. If the amount save's write were
  // lost to the rollover save landing with a stale amount, this row would
  // read "$40.00 of $0.00" instead of "$40.00 of $100.00" below.
  await thisMonth.getByRole("switch").click();
  await expect(thisMonth.getByRole("switch")).toBeChecked();
  await expect(thisMonth.getByText("$40.00 of $100.00")).toBeVisible();

  // $100.00 budgeted, $40.00 spent, rollover on: $60.00 should carry forward.
  // Clicking a Link only dispatches the click — it resolves before the
  // client-side transition lands, so interacting immediately would hit the
  // OLD month's still-mounted row (same categoryId key, not yet re-rendered)
  // and save against the WRONG month. Waiting for the URL is what makes the
  // next interaction land on the new month's row.
  await page.getByRole("link", { name: "Next month" }).click();
  await page.waitForURL(/month=/);
  const nextMonth = groceriesRow(page);
  // Nothing has been budgeted for the new month, and nothing needs to be:
  // the fold inherits the rollover setting from the last month that had a
  // budget row, so the $60 is already carried and the switch already reads
  // as on. (It used to have to be toggled here, because a month with no row
  // reset the carry to zero.)
  await expect(nextMonth.getByRole("switch")).toBeChecked();
  await expect(nextMonth.getByText(/\+\$60\.00 carried/)).toBeVisible();
  await expect(nextMonth.getByText("$0.00 of $60.00")).toBeVisible();

  // Budgeting the new month as well stacks its own $100 on top of the carry.
  await nextMonth.getByLabel("Groceries budget").fill("100.00");
  await nextMonth.getByLabel("Groceries budget").blur();
  await expect(nextMonth.getByText("$0.00 of $160.00")).toBeVisible();
});

test("rollover survives a month that was never budgeted", async ({ page }) => {
  await signUp(page);

  // Budget this month with rollover on and spend nothing, so the whole
  // $100.00 is unspent and should still be there two months later.
  await page.goto("/budgets");
  const first = groceriesRow(page);
  await first.getByLabel("Groceries budget").fill("100.00");
  await first.getByRole("switch").click();
  await expect(first.getByRole("switch")).toBeChecked();
  await expect(first.getByText("$0.00 of $100.00")).toBeVisible();

  // Skip next month entirely — never opened, never budgeted, which is what
  // happens whenever the user simply doesn't revisit the page. Jumping
  // straight to month + 2 by URL rather than clicking "Next month" twice
  // keeps the gap month genuinely untouched.
  await page.goto(`/budgets?month=${monthOffset(2)}`);
  const later = groceriesRow(page);
  await expect(later.getByRole("switch")).toBeChecked();
  await expect(later.getByText(/\+\$100\.00 carried/)).toBeVisible();
  await expect(later.getByText("$0.00 of $100.00")).toBeVisible();

  // And budgeting $100.00 here gives $200.00 available, not $100.00: the
  // carry survived the unbudgeted month in between.
  await later.getByLabel("Groceries budget").fill("100.00");
  await later.getByLabel("Groceries budget").blur();
  await expect(later.getByText("$0.00 of $200.00")).toBeVisible();
});
