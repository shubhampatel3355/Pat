# Audit, testing and clean-up — 26 Oct 2026

Full audit of the Admin (owner/admin) and Employee panels before new features. Everything below was run, not
assumed; where something could not be run it is listed under **Blocked**.

**How it was tested.** A separate copy of the code ran against `patmichaels_audit`, a fresh database loaded with the
demo seed (test data only). Your own `patmichaels` database and your dev server on port 3000 were not touched. Tools:
TypeScript, ESLint, Vitest, Playwright (headless Chrome), knip (dead code), a page crawler (every route × role ×
screen size, recording HTTP status, console errors/warnings, failed requests and horizontal overflow), and
per-module browser scripts that click through each workflow and check the database.

Roles used: **Owner** (Pat), **Admin** (Anita), **Employee with deals** (Neha), **Employee without deals** (Ravi),
plus Karthik and Sana for assignment, deactivation and reminder tests.

---

## 1. Module inventory and status

| # | Module | Admin panel (owner / admin) | Employee panel | Status |
|---|---|---|---|---|
| 1 | Sign-in & accounts | Sign-in, first-login password change, forgot/reset, invite → set password, change password, sign-out, owner/admin sign-in code | Same (no sign-in code) | **Passed** (code: verified in M5, unchanged) |
| 2 | Dashboard | Company / partner view, target, revenue + FY compare, pipeline, team activity, achievements, to-do | Employee View: quarter target, My WIP, My day, My incentive & payslip, to-do | **Passed** |
| 3 | WIP | All rows; create, edit, remark, delete; search, remark filter; raise invoice from a row | Own rows only; must be a broker; no delete; others' rows unreachable by link | **Passed** |
| 4 | Follow-ups & Tasks | All; assign, comment, reminders, board drag, reschedule, complete | Own / assigned only | **Passed** |
| 5 | Business Development | All meetings, client contacts visible, delete | Own meetings; contacts never sent to the browser; write-only | **Passed** |
| 6 | Vehicle Management | Book, confirm, complete, cancel | Book, cancel own; no confirm | **Fixed and verified** (B3) |
| 7 | Finance | Overview, entries, void, XLSX/PDF export, previous FY | No access (page, export, print) | **Passed** |
| 8 | Invoices / proforma | Raise (from WIP), PDF, print, email, payments, reversal, proforma → invoice, credit notes | No access (by default) | **Passed** |
| 9 | Payroll | Run: review, hold, TDS override, approve, disburse, emails; any payslip PDF | Redirected to Payslips & Incentive | **Fixed and verified** (B2) |
| 10 | Payslips & Incentive | — | Own payslips (month / quarter / year), incentive per deal | **Passed** |
| 11 | Teams | Add member + documents, invite, edit, role change, deactivate, CTC (payroll managers) | No access | **Passed** |
| 12 | Contracts & Vault | All folders; upload (type-checked), download, search, delete | Employee Documents (own) only; upload/delete own | **Passed** |
| 13 | Settings | General + targets, roles & permissions (owner edits, admin read-only), integrations, audit log by module | No access | **Fixed and verified** (S1, U2) |
| 14 | Shell | Rail, search (⌘K), quick create, notifications, account menu, partner switch | Same, scoped; phone bottom bar | **Fixed and verified** (U1, U3–U5) |
| 15 | APIs & background jobs | Uploads, signed downloads, PDFs, exports, search, live updates, health, email queue, reminders | Same endpoints refuse other people's data | **Fixed and verified** (B1, C1) |

## 2. Bugs found and fixed

| Id | Found in | Problem | Fix | Verified by |
|---|---|---|---|---|
| B1 | Reminders | A deactivated employee still received task reminder emails and notifications | Reminders skip people who are deactivated or removed (tasks, follow-ups, to-dos) | Live: tasks due in 2 min for Sana (active) and Karthik (deactivated) — Sana got notification + email, Karthik nothing |
| B2 | Payroll | "Your payslip is ready" notification and email sent employees to Payroll (now a redirect) | Link and email text point to Payslips & Incentive | Disbursal in the audit run: notifications `/payslips`, email text updated |
| B3 | Vehicles | A cab could be booked for a time already past today; the form always defaulted to 10:00 | Server refuses past times today; form defaults to the next half hour (computed on the server) | Unit tests (4 cases) + browser: default 16:30 at 16:24, 09:00 refused |
| S1 | Settings → Audit log | People with *View audit log* but not *View all payroll* could read CTCs and payslip amounts in before/after details | Salary fields and payroll entries are redacted for those viewers when the log is read | Browser, both directions, including the data sent to the page |
| S2 | Dev server | Next.js logged every Server Action call with its arguments — including passwords — to the terminal | `logging.serverFunctions: false` (production never logged them) | Config; dev log no longer prints actions |
| U1 | All pages | Refused pages and unknown addresses showed the unstyled framework 404 | Branded "Not available" card in the app and "Page not found" outside it, both with Back to dashboard | Crawl + e2e |
| U2 | Settings on phones | The page scrolled sideways: screen-reader labels inside the targets table escaped their scroll container | Every horizontal scroller is now a positioning context (7 places) | Crawl: 0 overflow in 252 page views |
| U3 | Phones | No menu and no way to sign out or change password below 768 px | Prototype's bottom bar (Home, WIP, Follow-ups, More) + avatar account menu | Browser + e2e mobile spec |
| U4 | All pages | No error page — a failing page would show the framework error screen | Branded error page with Try again and the log reference; global fallback | Build + render check |
| U5 | Navigation | No feedback while a page loads | Loading skeleton matching the page layout | Browser |
| C1 | Shutdown | The PDF browser (Chromium) wasn't closed when the app stopped | Closed on SIGTERM together with the job queue | Code review (deploy-time behaviour) |

## 3. Code clean-up

- Removed dead code with no callers: `isPermissionKey`, `previousPeriod`, `payslipScope`, `invoiceMeta`,
  `brokerSharesForUsers`, `runById`, `requestMeta`, `formatFileSize`, `PRICING_BASIS`, `STATUS_COLORS`,
  `firstInvoiceYear`, `IconBadge`, `Field`, `TextInput`, `TextArea`, `Select`, and `module-placeholder.tsx`
  (its design now serves the not-found and error pages), plus the imports they left unused.
- Connected `closePdfBrowser` to graceful shutdown instead of deleting it.
- knip after clean-up: no unused functions. The remaining notes are constants exported but only used in their own
  file, and files/packages used by tooling (Prisma config, Next proxy, Tailwind, esbuild, scripts) — false positives.
- No dependencies removed; each flagged one is used by configuration or tooling.

## 4. Test results

| Check | Result |
|---|---|
| TypeScript (`pnpm typecheck`) | Pass |
| ESLint (`pnpm lint`) | Pass, 0 warnings |
| Unit tests (`pnpm test`) | **201 passed** (13 files; +4 new for cab pick-up) |
| Production build | Pass |
| End-to-end (`pnpm test:e2e`, production build) | **10 passed** — sign-in ×4, WIP → invoice → PDF → email, payslip, employee access ×3 (new), phone (new) |
| Crawl (4 roles × 21 routes × 3 sizes = 252 page views) | 0 console errors/warnings, 0 failed requests, 0 sideways overflow, every refused page shows "Not available" |
| Module scripts | WIP 13/13 · Dashboard, to-do, notifications, search scoping 12/12 · Accounts & sessions 10/10 · Vehicles 8/8 · Audit-log redaction 4/4 · Reminders 5/5 · flows for Tasks, BD, Vault, Finance, Invoices, payment reversal, Payroll, Settings, Team invite all completed |
| Security review (code) | Every server action, API route, page and print page checks access on the server; no bypass found |
| Slow queries (> 500 ms) during testing | None logged |

Test-script issues met along the way (not app bugs) were fixed in the scripts: data that changes with the time of
day, labels with counts, duplicate titles from repeated runs, and the login rate limit (8 tries / 15 min) — which
was itself confirmed working.

## 5. Unresolved issues, external dependencies and risks

**Blocked — needs infrastructure or credentials**
- Docker image build (no Docker here), Coolify deployment, real SMTP sending, MinIO/S3 with encryption at rest,
  ClamAV scanning, Google sign-in, backups and restore, and the GitHub CI pipeline (the repository has no remote yet).

**Decisions for the business**
- A broker can set their own deal to "Payment Collected" by hand: the "deal closed" celebration fires and their
  incentive shows as earned without a recorded payment (audited). Option: only Finance may set the two money stages.
- Incentive is shown, not added to payslips automatically.
- Employees can't see or raise invoices unless an owner grants it.
- Payroll TDS is a flat estimate (10 % above ₹ 50,000 a month); confirm with the accountant.
- Invoice numbers start at 0001 per financial year; set the starting number before go-live if invoices were already
  issued this year (no screen for this yet).

**Known behaviour**
- Refused pages return HTTP 200 with the "Not available" card (a side effect of the loading state); nothing of the page is
  rendered, and API routes still return 404.
- Prisma 7.10 triggers a `pg` deprecation warning inside transactions; keep `pg` on 8.x.

**Not covered**
- Real phones and tablets (tested in emulated 390 px and 768 px widths), a screen-reader pass, load testing, and Lighthouse
  on mobile.

## 6. Verified end to end vs. still needs manual testing

- **Verified end to end in a running app:** every module in the inventory, for each role, including the cross-panel effects
  (employee actions reaching owners: assignments, comments, cab requests, notifications; owner changes reaching employees:
  permissions, targets, deactivation, role changes, payslips).
- **Needs manual testing on the real server:** email delivery and spam placement, file storage and downloads through
  MinIO, virus scanning, Google sign-in, PDFs inside the Docker image, backups/restore, and use on actual phones.

## 7. Assessment

The application is functionally stable: all modules work end to end for both panels, access control holds under direct API
and URL attempts, and the automated suites pass. The remaining risk is in what can only be proven on the production server
(email, storage, Docker, backups) and in the open business decisions above. It is ready for a staging deployment on the
VPS; go-live should follow a successful staging run of DEPLOY.md step 7 and one restore test.

## 8. Pre-deployment clean-up — 5 Nov 2026

**Found by running the app the way the Docker image does** (standalone output, `NODE_ENV=production`, the `pm_owner` and
`pm_app` roles from DEPLOY step 4, SMTP and an S3 API). Both blocked all email, sign-in codes and PDFs, and neither could
show up in tests that run through `next start` with a superuser:
- Playwright's `browsers.json` was missing from the standalone output, so the job workers could not load. Now listed in
  `outputFileTracingIncludes`.
- pg-boss ran `CREATE SCHEMA IF NOT EXISTS`, which Postgres refuses for `pm_app` even though the schema exists. It now only
  tries when the schema is missing.
- Also: bad configuration left the process running and answering 500s; in production it now exits, as the docs said. CI has
  a new step that starts the standalone output with the restricted role.

**Removed**: `design-reference/unpacked/` and `design-reference/assets/` (verified copies of what the offline HTML embeds and
of `public/brand`), `pino-pretty`, the `periodOfIso` helper, 7 unused types, 3 unused icons, 4 unused colour tokens, unused
`SEED_*` entries in the env schema, stale `minimumReleaseAgeExclude` entries, and the `export` keyword from 59 names only used
in their own file.

**Dependencies**: `pnpm audit` went from 18 known vulnerabilities (3 high) to 0: nodemailer 8 → 10, Next 16.4.5, Tailwind
4.3.4, AWS SDK 3.1161, Sentry 11.10, plus the three overrides described in the runbook. No major upgrades otherwise: ESLint
10, TypeScript 7, Vitest 5, Prisma 8 and Node types 26 are still to do.

**Shared code**: `useDeepLink` and `useFreshRow` (five screens), `useOverlay` (Drawer and Modal), `RupeeInput` (four amount
fields), `FIELD` and `LABEL` constants (about 60 repeats), `taskColumns`, `BrokerLine`.

**Performance**: the dashboard pipeline adds up in the database instead of loading every lead; Vault totals take one query,
not one per folder; saving targets reads once, not once per row; the session query no longer loads the password hash; the
Sentry SDK loads only with a DSN (start-up memory about 163 → 137 MB, ready about 1.8 → 1.2 s, measured locally).

**Verification**: typecheck, lint, 218 unit tests, 15 e2e specs; 45 screens (light, dark, employee, phone, open forms)
pixel-compared against the previous build on identical data with no differences; the production run in the first paragraph
through first sign-in, a proforma's PDF and email, a Vault upload and download, exports and password reset. Against a local
SMTP sink and a stand-in S3 API, on Windows: not Docker, not MinIO, not real mail.

**Still open**
- The `settings` table has no code using it. Dropping it needs a migration, so it is left for a decision.
- Chromium in the Docker image, real MinIO and real email delivery still need the staging run in DEPLOY step 7.
- Business decisions in section 5 are unchanged.
