import { expect, test } from "@playwright/test";
import { E2E } from "./accounts";
import { signIn, skipIntro } from "./helpers";

test.beforeEach(async ({ page, baseURL }) => skipIntro(page, baseURL!));

test("a closing dialog gets out of the way at once and is gone after its exit animation", async ({ page }) => {
  await signIn(page, E2E.employee.email, E2E.employee.password);
  await page.goto("/follow-ups");
  const open = page.getByRole("button", { name: /New follow-up/ });
  await open.click();
  await expect(page.getByRole("dialog", { name: "New follow-up" })).toBeVisible();

  await page.keyboard.press("Escape");
  // While it animates out it can't be clicked or focused, and focus is back on the page…
  const closing = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return dialog ? { inert: (dialog.parentElement as HTMLElement).inert, focusInside: dialog.contains(document.activeElement) } : null;
  });
  if (closing) expect(closing).toEqual({ inert: true, focusInside: false });
  // …so the page behind takes the very next click, and the old dialog is removed.
  await open.click();
  await expect(page.getByRole("dialog", { name: "New follow-up" })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
});

test("with reduced motion, a page appears at rest", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, E2E.employee.email, E2E.employee.password);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "WIP" }).click();
  await expect(page).toHaveURL(/\/wip$/);
  await expect(page.getByRole("heading", { name: "WIP" })).toBeVisible();
  const restState = () =>
    page.evaluate(() => {
      const el = document.querySelector("#pm-content > div")!;
      const cs = getComputedStyle(el);
      return { opacity: cs.opacity, transform: cs.transform };
    });
  expect(await restState()).toEqual({ opacity: "1", transform: "none" });
});
