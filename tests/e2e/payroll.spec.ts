import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { E2E } from "./accounts";
import { expectPdf, signIn, skipIntro } from "./helpers";

test("an employee downloads their own payslip and nobody else's", async ({ browser, baseURL }) => {
  // A manager's download link for someone else, to try as the employee afterwards.
  const admin = await browser.newContext({ baseURL, acceptDownloads: true });
  const adminPage = await admin.newPage();
  await skipIntro(adminPage, baseURL!);
  await signIn(adminPage, E2E.admin.email, E2E.admin.password);
  await adminPage.goto("/payroll");
  const karthik = adminPage.locator('[role="row"]', { hasText: "Karthik Iyer" }).first();
  const [request] = await Promise.all([adminPage.waitForRequest(/\/api\/payslips\//), karthik.getByRole("button", { name: "Download" }).click()]);
  const othersPayslip = new URL(request.url()).pathname;
  await admin.close();

  const context = await browser.newContext({ baseURL, acceptDownloads: true });
  const page = await context.newPage();
  await skipIntro(page, baseURL!);
  await signIn(page, E2E.employee.email, E2E.employee.password);

  // Employees use "Payslips & Incentive"; Payroll (everyone's pay, run controls) sends them there.
  await page.goto("/payroll");
  await expect(page).toHaveURL(/\/payslips$/);
  await expect(page.getByRole("heading", { name: "Payslips & Incentive" })).toBeVisible();
  await expect(page.getByText(/^Neha Sharma · /)).toBeVisible();
  await expect(page.getByRole("button", { name: /Approve payroll|Disburse via bank/ })).toHaveCount(0);
  await expect(page.getByRole("table", { name: "My incentive" })).toContainText("Expected");

  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.getByRole("button", { name: "Download payslip" }).first().click()]);
  expect(download.suggestedFilename()).toMatch(/^Payslip-Neha-Sharma-/);
  expectPdf(await readFile((await download.path())!));

  const res = await page.request.get(othersPayslip);
  expect(res.status()).toBe(404);
  await context.close();
});
