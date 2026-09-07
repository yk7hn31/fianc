import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

test("nothing in the app chrome links to a route that does not exist", async ({
  page,
}) => {
  // Regression test for a Critical finding: NAV_ITEMS carried a /settings
  // entry, so the sidebar listed it and the mobile bar made it one of four
  // tabs — and no such route was ever built. /settings exists now, so the
  // assertion is no longer about that one href: every link the chrome
  // renders gets visited, which catches the next entry added ahead of its
  // page as well as this one.
  await signUp(page);

  const hrefs = [
    ...new Set(await page.locator("nav a[href^='/']").evaluateAll((links) =>
      links.map((l) => l.getAttribute("href")!),
    )),
  ];
  // The sidebar is in the DOM at every width, so this holds on both projects.
  expect(hrefs.length).toBeGreaterThan(0);

  for (const href of hrefs) {
    const response = await page.goto(href);
    expect(response?.status(), `${href} should not 404`).toBeLessThan(400);
    await expect(
      page.getByText("This page could not be found"),
      `${href} should not render the 404 page`,
    ).toHaveCount(0);
  }
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
