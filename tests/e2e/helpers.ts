import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

/** The brand intro plays once per browser; the cookie it sets lets specs start on the sign-in card. */
export async function skipIntro(page: Page, baseURL: string) {
  await page.context().addCookies([{ name: "pm_intro", value: "1", url: baseURL }]);
}

export async function submitLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** The dashboard can open with an achievements celebration; close it so it doesn't cover the page. */
export async function dismissCelebration(page: Page) {
  const keep = page.getByRole("button", { name: "Keep going" });
  await keep.waitFor({ state: "visible", timeout: 2_500 }).catch(() => {});
  if (await keep.isVisible()) await keep.click();
}

export async function signIn(page: Page, email: string, password: string) {
  await submitLogin(page, email, password);
  await expect(page).toHaveURL(/\/dashboard/);
  await dismissCelebration(page);
}

/**
 * Attachments on the newest email to `to`, or null while none has arrived. Reads Mailpit when MAILPIT_URL is set
 * (CI), otherwise the dev file driver's .local/mail folder.
 */
export async function attachmentsOfMailTo(to: string): Promise<number | null> {
  const mailpit = process.env.MAILPIT_URL;
  if (mailpit) {
    const res = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const body = (await res.json()) as { messages: { Attachments: number }[] };
    return body.messages[0]?.Attachments ?? null;
  }
  const dir = path.join(process.cwd(), ".local", "mail");
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(`-${to}.json`)).sort();
  if (!files.length) return null;
  const mail = JSON.parse(await readFile(path.join(dir, files[files.length - 1]!), "utf8")) as { attachments?: string[] };
  return mail.attachments?.length ?? 0;
}

export function expectPdf(bytes: Buffer) {
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(5_000);
}
