import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

test("nothing in the app chrome links to a route that does not exist", async ({
  page,
}) => {
  // Regression test for a Critical finding: NAV_ITEMS carried a /settings
  // entry, so the sidebar listed it and the mobile bar made it one of four
  // tabs — and no such route was ever built on this branch. Asserted on the
  // href rather than on the label, because the label is what would come back
  // first if the entry were restored ahead of the page.
  await signUp(page);
  await expect(page.locator('nav a[href="/settings"]')).toHaveCount(0);
});

test("the More tab reaches the pages that are not in the bottom bar", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "the bottom bar is mobile-only");

  await signUp(page);
  await page.getByRole("button", { name: "More" }).click();

  // Scoped to the sheet: the desktop sidebar is hidden at this width but its
  // links are still in the DOM, so an unscoped lookup matches twice.
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("link", { name: "Categories" })).toBeVisible();
  await sheet.getByRole("link", { name: "Accounts" }).click();

  // Link.click() only dispatches the click; the client-side transition lands
  // afterwards.
  await page.waitForURL(/\/accounts/);
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
});
