// Visual parity: screenshots every module of the design prototype and the same screen of the running app
// (signed in, demo data loaded), then writes side-by-side images to docs/parity/.
//
//   PARITY_BASE=http://localhost:3000 PARITY_EMAIL=pat@patmichaels.in PARITY_PASSWORD=… pnpm parity
//
// Use a server whose database has the demo seed (pnpm db:seed:demo), so both sides show the same sample data.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const base = process.env.PARITY_BASE ?? "http://localhost:3000";
const email = process.env.PARITY_EMAIL ?? "pat@patmichaels.in";
const password = process.env.PARITY_PASSWORD;
if (!password) {
  console.error("Set PARITY_PASSWORD (and PARITY_EMAIL / PARITY_BASE if needed)");
  process.exit(1);
}
const out = path.join(root, "docs", "parity");
mkdirSync(out, { recursive: true });

// [slug, prototype rail title (null = landing screen), app path]
const SCREENS = [
  ["dashboard", null, "/dashboard"],
  ["wip", "WIP", "/wip"],
  ["follow-ups", "Follow-ups & Tasks", "/follow-ups"],
  ["business-development", "Business Development", "/business-development"],
  ["vehicles", "Vehicle Management", "/vehicles"],
  ["finance", "Finance", "/finance"],
  ["invoices", "Invoice", "/invoices"],
  ["payroll", "Payroll", "/payroll"],
  ["teams", "Teams", "/teams"],
  ["vault", "Contracts & Vault", "/vault"],
  ["settings", "Settings", "/settings"],
];
const VIEWPORT = { width: 1440, height: 900 };

const browser = await chromium.launch({ headless: true, ...(process.platform === "linux" ? {} : { channel: "chrome" }) });
const shots = {};

// Prototype
const proto = await browser.newPage({ viewport: VIEWPORT });
await proto.goto(pathToFileURL(path.join(root, "design-reference", "Pat Michaels OS (offline).html")).href);
await proto.waitForTimeout(6000); // unpack + intro
for (const [slug, title] of SCREENS) {
  if (title) await proto.click(`button[title="${title}"]`);
  await proto.mouse.move(1430, 890);
  await proto.waitForTimeout(900);
  shots[slug] = { proto: await proto.screenshot() };
}
await proto.click('button[title="Log out"]');
await proto.waitForTimeout(6000); // the intro replays before the sign-in card
shots.login = { proto: await proto.screenshot() };

// App
const ctx = await browser.newContext({ viewport: VIEWPORT });
const app = await ctx.newPage();
await app.goto(`${base}/login`);
await app.waitForTimeout(4500); // brand intro, as in the prototype
shots.login.app = await app.screenshot();
await app.getByLabel("Work email").fill(email);
await app.getByLabel("Password").fill(password);
await app.getByRole("button", { name: "Sign in", exact: true }).click();
await app.waitForURL(/\/dashboard/, { timeout: 30_000 });
for (const [slug, , route] of SCREENS) {
  await app.goto(`${base}${route}`);
  await app.waitForLoadState("networkidle").catch(() => {});
  const keep = app.getByRole("button", { name: "Keep going" });
  if (await keep.isVisible().catch(() => false)) await keep.click();
  await app.mouse.move(1430, 890);
  await app.waitForTimeout(900);
  shots[slug].app = await app.screenshot();
}

// Side by side
const sheet = await browser.newPage({ viewport: { width: 1440, height: 520 } });
const img = (buf) => `data:image/png;base64,${buf.toString("base64")}`;
for (const [slug, s] of Object.entries(shots)) {
  await sheet.setContent(`<!doctype html><body style="margin:0;font:600 13px system-ui;background:#1c1c1e;color:#fff">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px">
      <figure style="margin:0"><figcaption style="padding:4px 0 6px">Prototype · ${slug}</figcaption><img style="width:100%;display:block" src="${img(s.proto)}"></figure>
      <figure style="margin:0"><figcaption style="padding:4px 0 6px">App · ${slug}</figcaption><img style="width:100%;display:block" src="${img(s.app)}"></figure>
    </div></body>`);
  await sheet.locator("img").last().evaluate((el) => el.decode());
  writeFileSync(path.join(out, `${slug}.jpg`), await sheet.screenshot({ type: "jpeg", quality: 82, fullPage: true }));
  console.log("wrote", `docs/parity/${slug}.jpg`);
}
await browser.close();
