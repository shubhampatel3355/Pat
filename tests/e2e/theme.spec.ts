import { expect, test, type Page } from "@playwright/test";
import { E2E } from "./accounts";
import { signIn, skipIntro } from "./helpers";

test.beforeEach(async ({ page, baseURL }) => skipIntro(page, baseURL!));

const savedTheme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme ?? null);
const themeCookie = async (page: Page) => (await page.context().cookies()).find((c) => c.name === "pm_theme")?.value ?? null;
/** The page text colour: the palette's ink, so it tells which side of the theme is showing. */
const ink = (page: Page) => page.evaluate(() => getComputedStyle(document.body).color);
const LIGHT_INK = "rgb(28, 28, 30)";
const DARK_INK = "rgb(236, 238, 241)";

test("with nothing saved the app follows the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  const toggle = page.getByRole("switch", { name: "Dark mode" });
  await expect(toggle).toBeChecked();
  expect(await savedTheme(page)).toBeNull();
  expect(await ink(page)).toBe(DARK_INK);

  await page.emulateMedia({ colorScheme: "light" });
  await expect(toggle).not.toBeChecked();
  expect(await ink(page)).toBe(LIGHT_INK);
});

test("the switch applies at once, and the saved choice survives a reload and beats the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  const toggle = page.getByRole("switch", { name: "Dark mode" });
  await expect(toggle).toBeChecked();

  // Keyboard: the hidden checkbox is focusable and Space flips it.
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).not.toBeChecked();
  expect(await savedTheme(page)).toBe("light");
  expect(await themeCookie(page)).toBe("light");
  expect(await ink(page)).toBe(LIGHT_INK);

  await page.reload();
  await expect(page.getByRole("switch", { name: "Dark mode" })).not.toBeChecked();
  expect(await savedTheme(page)).toBe("light");
  expect(await ink(page)).toBe(LIGHT_INK);
});

test("the account menu switch themes every page, and brand-blue panels keep the light palette", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signIn(page, E2E.employee.email, E2E.employee.password);

  await page.getByRole("button", { name: /^Account: / }).click();
  const toggle = page.getByRole("switch", { name: "Dark mode" });
  await expect(toggle).not.toBeChecked();
  // Pointer: the visible part of the switch is its label.
  await page.locator(`label[for="${await toggle.getAttribute("id")}"]`).click();
  await expect(toggle).toBeChecked();
  expect(await savedTheme(page)).toBe("dark");
  expect(await ink(page)).toBe(DARK_INK);
  await page.keyboard.press("Escape");

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Vehicle Management" }).click();
  await expect(page).toHaveURL(/\/vehicles$/);
  expect(await savedTheme(page)).toBe("dark");
  expect(await ink(page)).toBe(DARK_INK);
  // The booking card's white fields keep dark text.
  const field = page.getByRole("region", { name: "Book a cab" }).getByRole("textbox").first();
  expect(await field.evaluate((el) => getComputedStyle(el).color)).toBe(LIGHT_INK);
});
