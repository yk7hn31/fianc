import { test, expect } from "@playwright/test";
import { signUp, addAccount, addExpense, addIncome } from "./helpers";

/**
 * The mobile list and the desktop table render the same row in two DOM
 * shapes at once — CSS hides one of them, it is never unmounted — so a bare
 * `getByText` always resolves to both and trips strict mode on either
 * project. See the identical note on `visibleRow` in transactions.spec.ts.
 */
function visible(page: import("@playwright/test").Page, text: string) {
  return page.getByText(text).filter({ visible: true });
}

/**
 * A row's "…" trigger, scoped to <main>. The mobile bottom bar now has its
 * own button named "More" — the tab that opens the sheet of secondary nav
 * items — so an unscoped `name: /Actions|More/` is genuinely ambiguous and
 * only picked the right one by DOM order.
 */
function rowActions(page: import("@playwright/test").Page, name: RegExp) {
  return page.locator("main").getByRole("button", { name }).first();
}

test("edit a transaction's amount", async ({ page }) => {
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "10.00", "Bakery");
  // addExpense only waits for the new row's text to appear, not for the
  // "New transaction" dialog to finish closing — on mobile that dialog's
  // closing animation can still have its #amount field mounted when the
  // very next step opens RowActions' own Edit dialog, giving two fields
  // both named "Amount" and tripping strict mode.
  await expect(page.locator("#amount")).toHaveCount(0);

  await rowActions(page, /Actions for Bakery/).click();
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

  await rowActions(page, /Actions/).click();
  // Delete is confirmed with a native confirm() — it destroys a financial
  // record permanently, and Playwright dismisses unhandled dialogs by
  // default, which would otherwise silently no-op this click.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("menuitem", { name: "Delete" }).click();

  await expect(page.getByText("No transactions yet.")).toBeVisible();
  await page.goto("/accounts");
  await expect(page.getByText("$500.00")).toBeVisible();
});

test("editing a transfer's amount moves both legs and both balances", async ({
  page,
}) => {
  // Regression test for a Critical finding: a disabled Base UI Select is not
  // a successful form control, so `name="accountId"` on the (disabled)
  // account field made every transfer edit submit with no accountId at all
  // and fail validation before ever reaching the transfer branch.
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
  await expect(page.locator("#amount")).toHaveCount(0);

  await rowActions(page, /Actions/).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByLabel("Amount").fill("150.00");
  await page.getByRole("button", { name: /Save/ }).click();

  // The dialog must actually close on success — if it stayed open with
  // "Check the form", the edit failed validation rather than saving.
  await expect(page.getByText("Check the form")).toHaveCount(0);

  const legs = page
    .locator("main")
    .locator("li, tr")
    .filter({ hasText: "Transfer" })
    .filter({ visible: true });
  await expect(legs).toHaveCount(2);
  await expect(legs.filter({ hasText: "−$150.00" })).toHaveCount(1);
  await expect(legs.filter({ hasText: "+$150.00" })).toHaveCount(1);

  await page.goto("/accounts");
  await expect(page.getByText("$350.00", { exact: true })).toBeVisible(); // 500 - 150
  await expect(page.getByText("$150.00", { exact: true })).toBeVisible(); // 0 + 150
});

test("bulk delete via checkboxes removes the selected rows", async ({
  page,
}, testInfo) => {
  // The checkbox column only exists in the desktop table — the mobile list
  // deliberately has none, so bulk selection is a desktop-only feature.
  test.skip(testInfo.project.name === "mobile", "bulk selection is desktop-only");

  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "10.00", "Bakery");
  await addExpense(page, "20.00", "Hardware");

  await page.goto("/transactions");
  await page.getByRole("checkbox", { name: "Select Bakery" }).check();
  await page.getByRole("checkbox", { name: "Select Hardware" }).check();
  await expect(page.getByText("2 selected")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByText("No transactions yet.")).toBeVisible();
});

test("selecting rows then changing page clears the stale selection", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "bulk selection is desktop-only");

  // Regression test for an Important finding: filtering, sorting, and paging
  // are all soft navigations that keep this component (and its `selected`
  // state) mounted while `rows` is replaced — so a row selected on page 1
  // stayed "selected" after Next, pointing at an id no longer on screen.
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "10.00", "Bakery");
  await addExpense(page, "20.00", "Hardware");

  await page.goto("/transactions?pageSize=1");
  await expect(page.getByText("Page 1 of 2")).toBeVisible();

  const firstRowCheckbox = page.locator("tbody tr").first().getByRole("checkbox");
  await firstRowCheckbox.check();
  await expect(page.getByText("1 selected")).toBeVisible();

  // Exact match: Next.js's own dev-tools button ("Open Next.js Dev Tools")
  // otherwise makes this a second match for the plain substring "Next".
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForURL(/page=2/);

  await expect(page.getByText(/selected/)).toHaveCount(0);
});

test("the edit dialog says which field was rejected, not just \"check the form\"", async ({
  page,
}) => {
  // Regression test for an Important finding: this form hand-rolled its
  // Label + Input + error paragraph and rendered a message for `amount`
  // only, so a rejected date, account, category, payee or note produced a
  // bare "Check the form" toast with nothing on screen saying which.
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "10.00", "Bakery");
  await expect(page.locator("#amount")).toHaveCount(0);

  await rowActions(page, /Actions for Bakery/).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByLabel("Date").fill("");
  await page.getByRole("button", { name: /Save/ }).click();

  const date = page.getByLabel("Date");
  await expect(page.locator("#date-error")).toHaveText("Choose a date");
  await expect(date).toHaveAttribute("aria-invalid", "true");
  // The message is wired to the field, not merely next to it: without this a
  // screen reader announces "invalid" and never reads why.
  await expect(date).toHaveAttribute("aria-describedby", "date-error");
});

test("filter by type", async ({ page }) => {
  // The spec requires a type filter. `normaliseFilters` and `buildTxWhere`
  // understood `type` from the start, but no control ever set it.
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "10.00", "Bakery");
  await addIncome(page, "500.00", "Payday");

  await page.goto("/transactions");
  // Base UI resolves a closed trigger's text from the `items` map, not from
  // the unmounted options, so without one every filter here reads "__any".
  // `toContainText`, not `toHaveText`: the trigger also renders the select's
  // own chevron glyph.
  await expect(page.getByLabel("Types")).toContainText("All types");
  await expect(page.getByLabel("Accounts")).toContainText("All accounts");
  await expect(page.getByLabel("Categories")).toContainText("All categories");

  await page.getByLabel("Types").click();
  await page.getByRole("option", { name: "Income" }).click();
  await page.waitForURL(/type=income/);

  await expect(visible(page, "Payday")).toBeVisible();
  await expect(visible(page, "Bakery")).toBeHidden();
});

test("an out-of-range page offers a way back that keeps the filters", async ({
  page,
}) => {
  // Regression test for an Important finding: the "Nothing on page N" branch
  // sits outside the one that renders <Pagination>, so there was no Previous
  // button and the only escape was editing the URL by hand.
  await signUp(page);
  await addAccount(page, "Checking", "1000");
  await addExpense(page, "10.00", "Bakery");
  await addExpense(page, "20.00", "Hardware");

  await page.goto("/transactions?q=Bakery&page=9");
  await expect(page.getByText(/Nothing on page 9/)).toBeVisible();

  await page.getByRole("link", { name: "Back to page 1" }).click();
  // Link.click() only dispatches the click; the client-side transition lands
  // afterwards.
  await page.waitForURL(/q=Bakery/);
  await expect(page).not.toHaveURL(/[?&]page=/);

  // The search survived the trip — the whole point of the link.
  await expect(visible(page, "Bakery")).toBeVisible();
  await expect(visible(page, "Hardware")).toBeHidden();
});
