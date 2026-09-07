import { test, expect, type Locator, type Page } from "@playwright/test";
import { signUp, addAccount, addExpense } from "./helpers";

/** The Groceries row, scoped so its "Rollover" switch isn't ambiguous with
 * every other category's identically-labelled switch on the same page. */
function groceriesRow(page: Page): Locator {
  return page.locator("main li").filter({ hasText: "Groceries" });
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
  // Nothing has been budgeted for the new month yet, so there is no row to
  // fold rollover into — the Amount input is uncontrolled and this row's
  // component instance isn't remounted by the search-param-only navigation
  // (same categoryId key), so it still holds the "100.00" typed a moment
  // ago. Toggling the switch here re-affirms that same $100 budget for the
  // new month with rollover on, which is what makes this month's own
  // rollover flag true and lets last month's $60 fold forward into it —
  // available = 100 (this month's own budget) + 60 (carried in) = 160.
  await nextMonth.getByRole("switch").click();
  await expect(nextMonth.getByRole("switch")).toBeChecked();
  await expect(nextMonth.getByText("$0.00 of $160.00")).toBeVisible();
  await expect(nextMonth.getByText(/\+\$60\.00 carried/)).toBeVisible();
});
