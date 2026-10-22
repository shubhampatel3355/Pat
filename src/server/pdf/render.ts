import "server-only";
import { chromium, type Browser } from "playwright-core";
import { signPayload } from "../crypto";
import { env, internalAppUrl } from "../env";
import { logger } from "../logger";

/**
 * PDFs are printed by headless Chromium from the app's own /print/* pages, so the PDF, the on-screen
 * preview and the browser's "Save as PDF" all share one layout. The print pages accept a short-lived
 * signed token instead of a session cookie.
 */

let browserPromise: Promise<Browser> | undefined;

async function launch(): Promise<Browser> {
  const path = env().CHROMIUM_PATH;
  const browser = await chromium.launch({
    headless: true,
    // In the container Chromium runs as a non-root user without user namespaces.
    ...(path ? { executablePath: path, chromiumSandbox: false } : process.platform === "win32" || process.platform === "darwin" ? { channel: "chrome" } : {}),
    args: ["--disable-dev-shm-usage", "--font-render-hinting=none"],
  });
  browser.on("disconnected", () => {
    browserPromise = undefined;
  });
  return browser;
}

async function getBrowser(): Promise<Browser> {
  browserPromise ??= launch().catch((err) => {
    browserPromise = undefined;
    throw err;
  });
  return browserPromise;
}

export type PrintTarget = { kind: "invoice"; id: string } | { kind: "payslip"; userId: string; periodType: string; period: string } | { kind: "finance"; fy: string };

export function printToken(target: PrintTarget, ttlSeconds = 120): string {
  return signPayload("print", target as unknown as Record<string, unknown>, ttlSeconds);
}

export function printPath(target: PrintTarget): string {
  const token = encodeURIComponent(printToken(target));
  switch (target.kind) {
    case "invoice":
      return `/print/invoice/${target.id}?t=${token}`;
    case "payslip":
      return `/print/payslip/${target.userId}/${target.periodType}/${encodeURIComponent(target.period)}?t=${token}`;
    case "finance":
      return `/print/finance/${encodeURIComponent(target.fy)}?t=${token}`;
  }
}

/** Renders an app print page to an A4 PDF. */
export async function renderPdf(target: PrintTarget): Promise<Buffer> {
  const started = Date.now();
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    const response = await page.goto(`${internalAppUrl()}${printPath(target)}`, { waitUntil: "networkidle", timeout: 30_000 });
    if (!response || !response.ok()) throw new Error(`Print page responded ${response?.status() ?? "no response"}`);
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    logger.info({ kind: target.kind, ms: Date.now() - started, bytes: pdf.length }, "pdf rendered");
    return pdf;
  } finally {
    await context.close();
  }
}

export async function closePdfBrowser() {
  const b = await browserPromise?.catch(() => undefined);
  await b?.close();
  browserPromise = undefined;
}
