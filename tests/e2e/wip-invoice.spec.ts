import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { E2E } from "./accounts";
import { attachmentsOfMailTo, expectPdf, signIn, skipIntro } from "./helpers";

test.beforeEach(async ({ page, baseURL }) => skipIntro(page, baseURL!));

test("create a WIP lead, raise its invoice and get the PDF", async ({ page }) => {
  const run = Date.now().toString().slice(-6);
  const tenant = `E2E Tenant ${run}`;
  const billingEmail = `accounts.${run}@example.com`;
  await signIn(page, E2E.admin.email, E2E.admin.password);

  // 1. New WIP row
  await page.goto("/wip?new=1");
  await page.getByPlaceholder("e.g. Zeta Fintech").fill(tenant);
  await page.getByPlaceholder("10,000").fill("4500");
  await page.getByPlaceholder("90").fill("85.5");
  await page.getByPlaceholder("e.g. RMZ Ecospace").fill("Prestige Shantiniketan");
  await page.getByPlaceholder("e.g. Bellandur, ORR").fill("Whitefield");
  await page.getByPlaceholder("e.g. RMZ Corp / WeWork").fill("Prestige Group");
  await page.getByRole("button", { name: "Add to WIP" }).click();
  const row = page.getByRole("button", { name: tenant, exact: true });
  await expect(row).toBeVisible();

  // 2. Raise the invoice from the row (the form is prefilled from WIP)
  await row.click();
  await page.getByRole("link", { name: "Raise invoice" }).click();
  await expect(page).toHaveURL(/\/invoices/);
  await expect(page.getByText(`Linked to WIP · ${tenant}`)).toBeVisible();
  const form = page.locator('section[aria-label="Raise invoice"]');
  await expect(form.getByPlaceholder("e.g. Zeta Fintech Pvt Ltd")).toHaveValue(tenant);
  await form.getByPlaceholder("Building, street, area, city, PIN").fill("Prestige Shantiniketan, Whitefield, Bengaluru 560048");
  await form.getByPlaceholder("GSTIN · e.g. 29AAKFP4821L1ZR").fill("27AAPFU0939F1ZV");
  await form.getByPlaceholder("98450 00000").fill("98450 21734");
  await form.getByPlaceholder("accounts@company.com").fill(billingEmail);
  await form.getByPlaceholder("e.g. Net 30 days from invoice date").fill("Net 30 days");
  await form.getByRole("button", { name: "Raise invoice" }).click();
  await expect(page.getByText(`raised to ${tenant}`)).toBeVisible();

  // 3. Open the branded document; print and the server-rendered PDF
  const invoice = page.locator('[role="row"][id^="inv-"]', { hasText: tenant }).first();
  await invoice.click();
  const doc = page.getByRole("dialog", { name: /^Invoice PM\// });
  await expect(doc).toBeVisible();
  await expect(doc.getByText("IGST")).toBeVisible(); // Maharashtra client → IGST
  await page.evaluate(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => void ((window as unknown as { printed: number }).printed += 1);
  });
  await doc.getByRole("button", { name: "Print / Save as PDF" }).click();
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);

  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), doc.getByRole("button", { name: "Download PDF" }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  expectPdf(await readFile((await download.path())!));

  // 4. Email it to the client (sent by the background worker, PDF attached)
  await doc.getByRole("button", { name: "Email", exact: true }).click();
  await expect(page.getByText("is on its way")).toBeVisible();
  await expect.poll(() => attachmentsOfMailTo(billingEmail), { timeout: 60_000 }).toBe(1);

  // 5. The WIP row moved to Invoice Raised
  await page.keyboard.press("Escape");
  await page.goto("/wip");
  await expect(page.getByLabel(`Remark for ${tenant}`)).toHaveValue("INVOICE_RAISED");
});
