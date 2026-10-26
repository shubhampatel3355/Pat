import { expect, test } from "@playwright/test";
import { E2E } from "./accounts";
import { signIn, skipIntro } from "./helpers";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("phones get the bottom bar, the full page list and sign-out", async ({ page, baseURL }) => {
  await skipIntro(page, baseURL!);
  await signIn(page, E2E.employee.email, E2E.employee.password);

  const bar = page.getByRole("navigation", { name: "Mobile" });
  await expect(bar).toBeVisible();
  await bar.getByRole("link", { name: "WIP" }).click();
  await expect(page).toHaveURL(/\/wip$/);
  await expect(bar.getByRole("link", { name: "WIP" })).toHaveAttribute("aria-current", "page");

  // "More" lists every page the person may open.
  await bar.getByRole("button", { name: /More/ }).click();
  const palette = page.getByRole("dialog", { name: "Search" });
  await expect(palette.getByRole("option", { name: /Payslips & Incentive/ })).toBeVisible();
  await page.keyboard.press("Escape");

  // Nothing is wider than the screen.
  const overflow = await page.evaluate(() => {
    const main = document.getElementById("pm-content")!;
    return main.scrollWidth - main.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);

  // The account menu (and so sign-out) is reachable on a phone.
  await page.getByRole("button", { name: /^Account: / }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
});
