import { expect, test } from "@playwright/test";
import { E2E } from "./accounts";
import { dismissCelebration, signIn, skipIntro, submitLogin } from "./helpers";

test.beforeEach(async ({ page, baseURL }) => skipIntro(page, baseURL!));

test("the brand intro hands over to the sign-in card", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Work email")).toBeEditable();
  await context.close();
});

test("a wrong password is refused", async ({ page }) => {
  await submitLogin(page, E2E.admin.email, "Not-The-Password-1");
  await expect(page.getByText("That email and password don't match.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("an owner's first sign-in replaces the temporary password", async ({ page }) => {
  await submitLogin(page, E2E.owner.email, E2E.owner.tempPassword);
  await expect(page).toHaveURL(/\/change-password/);
  await expect(page.getByRole("heading", { name: "Choose your password" })).toBeVisible();
  await page.getByLabel("Temporary password").fill(E2E.owner.tempPassword);
  await page.getByLabel("New password", { exact: true }).fill(E2E.owner.newPassword);
  await page.getByLabel("Confirm new password").fill(E2E.owner.newPassword);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await dismissCelebration(page);

  // Sign out, then back in with the new password.
  await page.getByRole("button", { name: /^Account: / }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, E2E.owner.email, E2E.owner.newPassword);
  await expect(page.getByRole("button", { name: "Account: Pat Michaels" })).toBeVisible();
});

test("signed-out visitors are sent to sign in and come back", async ({ page }) => {
  await page.goto("/finance");
  await expect(page).toHaveURL(/\/login\?next=%2Ffinance$/);
  await page.getByLabel("Work email").fill(E2E.admin.email);
  await page.getByLabel("Password").fill(E2E.admin.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/finance$/);
});
