import { expect, test } from "@playwright/test";
import pg from "pg";
import { E2E } from "./accounts";
import { signIn, skipIntro } from "./helpers";

/** Ids of records the employee must not reach (read straight from the e2e database). */
async function foreignIds() {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const invoice = await db.query<{ id: string }>("SELECT id FROM invoices WHERE type = 'INVOICE' LIMIT 1");
    const colleague = await db.query<{ id: string }>("SELECT id FROM users WHERE email = $1", ["karthik@patmichaels.in"]);
    return { invoiceId: invoice.rows[0]!.id, colleagueId: colleague.rows[0]!.id };
  } finally {
    await db.end();
  }
}

test.describe("employee access", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await skipIntro(page, baseURL!);
    await signIn(page, E2E.employee.email, E2E.employee.password);
  });

  test("restricted pages show 'Not available' and nothing of the page", async ({ page }) => {
    for (const path of ["/finance", "/invoices", "/teams", "/settings", "/vault/pm", "/vault/client"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Not available" }), path).toBeVisible();
      await expect(page.getByRole("link", { name: "Back to dashboard" })).toBeVisible();
    }
    // The menu doesn't offer them either.
    const menu = page.getByRole("navigation", { name: "Main" });
    for (const label of ["Finance", "Invoice", "Payroll", "Teams", "Settings"]) await expect(menu.getByRole("link", { name: label, exact: true })).toHaveCount(0);
  });

  test("restricted APIs refuse the employee", async ({ page }) => {
    const { invoiceId, colleagueId } = await foreignIds();
    expect((await page.request.get("/api/finance/export?fy=2026&format=xlsx")).status()).toBe(404);
    expect((await page.request.get(`/api/invoices/${invoiceId}/pdf`)).status()).toBe(404);
    expect((await page.request.get(`/api/payslips/${colleagueId}/YEARLY/FY2026-27`)).status()).toBe(404);
    const upload = await page.request.post("/api/files", {
      headers: { origin: new URL(page.url()).origin },
      multipart: { folder: "PM_DOCUMENTS", files: { name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("hello") } },
    });
    expect(upload.status()).toBe(403);
  });
});

test("an unknown address shows the branded 404 (signed-out visitors go to sign in first)", async ({ page, baseURL }) => {
  await skipIntro(page, baseURL!);
  await page.goto("/no-such-page");
  await expect(page).toHaveURL(/\/login\?next=%2Fno-such-page$/);
  await signIn(page, E2E.employee.email, E2E.employee.password);
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
