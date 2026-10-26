# Pat Michaels OS — Architecture

Production web application for **Pat Michaels Developers LLP** (commercial real-estate advisory, Bengaluru).
The visual source of truth is `design-reference/Pat Michaels OS (offline).html` (unpacked into
`design-reference/unpacked/`). This document confirms the stack, the data model and the delivery plan.

---

## 1. Stack (confirmed, pinned)

| Concern | Choice | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | ≥ 22.13 | Docker image `node:22-bookworm-slim` |
| Framework | Next.js App Router + React Server Components | 16.4.2 / React 19.3 | Turbopack build, `output: 'standalone'`, `proxy.ts` (Node runtime). `cacheComponents` **off**: every screen is per-user and dynamic. |
| Language | TypeScript | 5.9.3 | TS 7 (native port) not yet used by Next's type tooling. |
| Styling | Tailwind CSS v4 (`@tailwindcss/turbopack`) | 4.3.3 | Design tokens as CSS variables in `@theme` (see §4). |
| Font | Urbanist, self-hosted from `@fontsource-variable/urbanist` via `next/font/local` | 5.3.0 | The prototype ships the Urbanist variable font; weights 300/400/500 (+600/700 used on a few labels). |
| Database | PostgreSQL | 17 | Coolify-managed in production; `docker-compose` locally; `embedded-postgres` for Docker-less dev. |
| ORM | Prisma (`prisma-client` generator + `@prisma/adapter-pg`) | 7.10.1 | Config in `prisma7.config.ts`; migrations checked in. Prisma 8 is still RC. |
| Auth | Auth.js (`next-auth` v5) — Credentials + optional Google | 5.0.0-beta.32 | JWT session cookie (httpOnly, `Secure`, `SameSite=Lax`); user re-validated from DB on every request. **Note:** Auth.js is now maintained by the Better Auth team (security fixes only). All auth code sits behind `src/server/auth/*` so it can be swapped later. |
| Passwords | argon2id (`@node-rs/argon2`) | 2.2.2 | Prebuilt binaries for Windows/Linux, no node-gyp. |
| Validation | Zod (shared client/server schemas in `src/lib/schemas`) | 4.6.7 | |
| Jobs / email queue | pg-boss (Postgres-backed, no Redis) | 12.38.0 | Jobs enqueued **inside** the business transaction via `fromPrisma(tx)` (transactional outbox). Worker runs in-process, started from `instrumentation.ts`. |
| Email | Nodemailer (SMTP: Hostinger mail or Resend SMTP) | 8.0.x | Dev: Mailpit (compose) or a file transport. |
| File storage | S3-compatible (MinIO on the VPS via Coolify, or Hostinger Object Storage) via AWS SDK v3 | 3.x | Uploads go through the app (validation, MIME sniffing, optional ClamAV), downloads are short-lived **presigned URLs** only. |
| PDF | Headless Chromium (`playwright-core`) printing the app's own `/print/*` pages | 1.64.1 | One layout for on-screen preview, browser print, emailed PDF and payslips. Chromium is installed in the runtime image. |
| Spreadsheets | ExcelJS | 4.4.0 | Finance export. |
| Logging | pino (JSON) | 10.x | Slow-query logging via a Prisma query extension. Sentry optional (`SENTRY_DSN`). |
| Tests | Vitest (unit), Playwright (e2e + visual parity) | 4.1 / 1.64 | |

### Deviations from the brief (deliberate, flagged)
1. **Pricing basis** keeps the prototype's three options (Per sq ft / Per seat / Lumpsum). "Per sq ft" hides seats, "Per seat" hides area.
2. **Brokers on WIP rows**: the prototype drawer allows several primary and secondary brokers, so brokers are rows (`LeadBroker` with role `PRIMARY | SECONDARY`) instead of a single `primaryBrokerId`. Primary brokers are users only; secondary brokers may be external names.
3. **Pipeline card** on the Dashboard is not in the prototype; it is built in the prototype's card language (stage bar by WIP remark, total, open count, no weighted line) and needs design sign-off.
4. **Finance** in the prototype shows 4 KPI cards in 2 columns; built as the brief asks: 6 blue KPI cards, 3 per row, all computed — the prototype's Revenue, Expenses, Profit and Receivables plus Collections and Payroll. Additions needed to make it usable (in the prototype's own styles, for design review): a financial-year selector and period line under the title, an **Add entry** button opening the prototype's income/expense modal (with a date field), and a **Recent entries** list in the prototype's ledger-row style where manual entries can be voided with a reason.
5. **Business Development "View as" switch** is a prototype demo affordance; production uses the signed-in role.
6. **Lead temperature** label is "Lukewarm" (brief) rather than "Luke Warm" (prototype).
7. **Login OTP step** shown in the prototype ("Verify it's you") is not in the brief; implemented as an optional emailed 6-digit code for Owners/Admins behind `AUTH_OTP_FOR_ADMINS` (default off). The prototype sends it to a phone and offers "Use backup code"; the app emails it (masked address shown) and has no backup codes, so that link is left out. Codes are stored hashed, expire in 10 minutes, are single-use and are cancelled after 5 wrong tries; Google sign-in skips the code.
8. **Employee dashboard** has no design yet — built from existing components, flagged in the README for design review.
9. **Payroll** follows the prototype's arithmetic (PF 12 % of basic = 50 % of fixed pay; TDS 10 % above ₹ 50,000) and adds **Karnataka professional tax** (₹ 200 a month, ₹ 300 in February), so the demo October run nets ₹ 6,41,160 instead of the prototype's ₹ 6,42,960. Payslips split fixed pay Basic 50 % / HRA 20 % / Special 30 %; TDS is an editable estimate. The **Payslips** button opens the run's review drawer; approval and disbursal ask for confirmation. Partners are not on payroll.
10. **Follow-ups** are their own records (contact, type, note, owner, due time, optional WIP row) instead of the prototype's per-lead "next action", so they can be created from quick-create and **+ New follow-up**, reminded and rescheduled; the agenda, week view and "Move to" choices follow the prototype.
11. **Business Development**: the tenant name opens an edit drawer (with delete for people who see all meetings); client contact info is write-only for people who can't see it.
12. **Contracts & Vault** says "encrypted at rest" only when uploads are written with server-side encryption (`S3_SSE`); the root **Upload** modal asks whose documents they are when filing Employee Documents for someone else; folders open at `/vault/[folder]`.
13. **Vehicle Management**: people with *Manage cab bookings* get **Confirm** / **Complete** on each row; pick-up chips are the office (from `COMPANY_ADDRESS`), the airport and the most-used recent pick-up.
14. **Task reminders**: the WhatsApp channel toggle is shown but disabled until the WhatsApp integration is connected.
15. **Teams** shows every active member, including admin and operations staff without targets ("No target set"), because it is where members are added, edited and deactivated; the prototype shows only the six sales cards.
16. **Settings → General**: company identity (legal name, GSTIN, RERA, address, bank, signatory) comes from the server configuration (`COMPANY_*`) and is read-only, so the prototype's per-row **Edit** buttons are left out; the preference rows describe what the app actually does (the prototype's "Working days" and "Lead assignment" are not features). A **Targets** editor (company, partners, members, by financial year and quarter) is added below. **Integrations** shows the real state of email, storage, virus scanning, Google sign-in and error tracking; the prototype's planned integrations appear only with `FEATURES=integrations-preview`.
17. **Payment reversal** is not in the prototype: an invoice's **Payments (n)** action lists its payments, and people who can record payments can reverse one with a reason. The invoice status, the Finance receipt and the WIP stage ("Payment Collected" → "Invoice Raised") follow in one transaction.
18. **Colour contrast**: small text on the grey chips and cards uses slightly darker shades than the prototype (`muted-strong` #4D4D52 instead of #55555A on #C7C7C7; YoY green #216A36 / red #A8302C instead of #3E9B52 / #C93C37 on #DCDCDC) to meet WCAG AA 4.5:1. Lighthouse (desktop) scores Dashboard and WIP 100 for performance, accessibility and best practices.

---

## 2. Application structure

```
prisma/                 schema.prisma, migrations/, seed.ts (prod-safe), seed-demo.ts (prototype data)
prisma7.config.ts       Prisma CLI config (datasource URL, migrations path)
src/
  app/
    layout.tsx          <html>, fonts, globals
    (auth)/             login, change-password, set-password (invite + reset), forgot-password
    (app)/              authenticated shell (top bar, rail) + one folder per module
    print/              chrome-less document pages used by Chromium (invoice, proforma, payslip, finance)
    api/                auth, health, live (activity + notifications poll), search, files, pdf, export
  components/
    ui/                 primitives that encode the prototype's look (Button, Card, BlueCard, Chip, Segmented,
                        Field, Drawer, Modal, Avatar, StatusPill, Toggle, Toast, RowTable …)
    shell/              TopBar, Rail, CommandPalette, QuickCreate, Notifications, ViewSwitch
    <module>/           screen-specific client components
  lib/                  isomorphic helpers: money (paise, Indian grouping, ₹ L / Cr), fy, gstin, dates (IST),
                        constants (remarks, colours), schemas/ (Zod)
  server/               server-only: env, db, logger, auth/, policy/ (can + scopes), audit, actions/,
                        services/, storage/, pdf/, email/, queue/, rate-limit, crypto, signed-urls
  proxy.ts              CSP nonce + optimistic auth redirect
  instrumentation.ts    env validation at boot, pg-boss worker start, error reporting hook
tests/unit, tests/e2e, tests/visual
```

**Request flow.** Pages are Server Components. Each page calls `requireUser()` (reads the Auth.js cookie,
loads the user row, rejects inactive users or stale `sessionVersion`, enforces first-login password change),
then calls a service with the user so every query is scoped by policy. Mutations are Server Actions built with
`defineAction({ schema, authorize, handler })`, which: checks same-origin, loads the user, validates input with
Zod, calls `can()`, runs the handler in one transaction, writes the audit row in that transaction, enqueues
side-effect jobs in that transaction, and returns `{ ok, message, data } | { ok: false, error, fieldErrors }`
which the client turns into a toast. Route handlers (uploads, downloads, PDF, export) use the same guards.

---

## 3. Roles, permissions, audit

Roles: `OWNER` (Pat Michaels, Arjun Rao — the partners), `ADMIN`, `EMPLOYEE`.

`can(user, action, resource)` in `src/server/policy` is the single entry point. It combines:
- **role permission flags** from the `permissions` table (editable in Settings → Roles & permissions;
  `OWNER` is always allowed and its column is locked),
- **ownership rules** (e.g. an employee is a broker on the WIP row, is the BD meeting's broker, owns the payslip,
  is the subject of the Employee Document),
- **hard rules** that are not toggleable (only owners change owners or role definitions).

List queries use `scopeWhere(user, resource)` built from the same rules, so lists and single-record checks agree.

| Permission key (excerpt) | Owner | Admin (default) | Employee (default) |
|---|---|---|---|
| `wip.view_all`, `wip.edit_all`, `wip.delete` | ✓ | ✓ | own rows only (broker on the row) |
| `bd.view_all`, `bd.view_contacts` | ✓ | ✓ | own meetings; **contact info stripped server-side** |
| `tasks.view_all` | ✓ | ✓ | own / assigned |
| `vehicles.manage` (confirm / complete) | ✓ | ✓ | book + cancel own; sees all bookings |
| `finance.view`, `finance.export`, `invoices.view`, `invoices.create`, `invoices.credit_note` | ✓ | ✓ | ✗ |
| `payroll.view_all`, `payroll.run` | ✓ | ✓ | own row + own payslips |
| `teams.view`, `teams.manage` | ✓ | ✓ | ✗ |
| `vault.pm`, `vault.client`, `vault.employee_all` | ✓ | ✓ | Employee Documents → own files only |
| `settings.manage`, `audit.view` | ✓ | ✓ | ✗ |
| roles & owners management | ✓ | ✗ (not toggleable) | ✗ |

**Audit log.** Every create / update / delete / export / login (success and failure) writes `audit_logs`
(actor, module, action, entity, human text, IP, user agent, before/after JSON with secrets and ciphertext removed).
Rows carry a visibility (`PUBLIC`, `RESTRICTED` — owners/admins plus `subject_user_ids`, `PRIVATE`) and a `feed`
flag; the Dashboard "Team activity" ticker polls feed rows the viewer is allowed to see.

---

## 4. Design system

Tokens extracted from the prototype into `src/app/globals.css` (`@theme`):

- Blues `#001233` / `#002855` / `#023E7D` (primary action `#023E7D`; blue cards `linear-gradient(160deg,#023E7D,#002855[,#001233])`, white text).
- Neutrals: app frame `#DCDCDC`, surface `#E8E8E8`, input/hover `#F0F0F0`, card `#D1D1D1`, chips `#C7C7C7` / `#DCDCDC`, text `#1C1C1E`, secondary `#55555A`.
- Status: success `#3E9B52`, warning `#F5B73B`, danger `#C93C37`, neutral `#A8A8AD`; WIP remark colours from the prototype.
- Shape: pills 999px, cards 20–28px, rows 16px; raised / lifted / primary / focus shadows; frosted-glass drawers
  (`rgba(244,244,244,.86)` + `blur(24px)`).
- Money: stored as **integer paise** (`BIGINT`), shown with Indian grouping (`₹ 12,36,640`) or compact
  (`₹ 20 L`, `₹ 1.5 Cr`) on cards. Never raw long digits in cards.
- Time: stored UTC, shown in `Asia/Kolkata`; financial year April–March everywhere.
- Accessibility: icon buttons get `aria-label`s; 40px pill buttons keep their look but get a 44px hit area;
  contrast checked against 4.5:1.

---

## 5. Data model (Prisma, snake_case tables, UUIDv7 keys)

All tables have `id uuid` (v7), `created_at`, `updated_at`; soft-delete (`deleted_at`) on users, leads,
bd_meetings, tasks, follow_ups, files, ledger_entries. Money columns are `BIGINT` paise.

| Model | Key fields |
|---|---|
| **User** | email (unique, lower-case), name, phone, role, title, partner_id → User (owner), date_of_joining, ctc_annual_paise, active, password_hash, must_change_password, session_version, last_login_at, achievements_seen_at |
| **AuthToken** | user_id, type (`INVITE`, `PASSWORD_RESET`, `LOGIN_OTP`), token_hash (sha-256), expires_at, used_at, attempts |
| **Permission** | (role, key) PK, allowed, updated_by_id |
| **RateLimit** | (key, window_start) PK, count |
| **Lead** (WIP row) | serial (Sl. No.), tenant_name, pricing_basis (`PER_SQFT`/`PER_SEAT`/`LUMPSUM`), area_sqft, seats, rate_paise, building, location, landlord_type (`LANDLORD`/`OPERATOR`), landlord_name, est_fees_paise, closure_date, remark (8 values), remark_changed_at, created_by_id |
| **LeadBroker** | lead_id, role (`PRIMARY`/`SECONDARY`), user_id **or** external_name (check constraint), share_pct?, position |
| **Task** | title, assignee_id, created_by_id, due_at, priority (`URGENT`…`LOW`), status (`TODO`/`IN_PROGRESS`/`DONE`), lead_id?, remind_in_app/email/whatsapp, completed_at |
| **TaskComment** | task_id, author_id, body |
| **FollowUp** | lead_id?, contact_name, owner_id, type (`CALL`/`WHATSAPP`/`EMAIL`/`MEETING`/`SITE_VISIT`), note, due_at, completed_at |
| **Todo** | user_id, text, due_date?, due_time?, important, remind, note, done, done_at |
| **BdMeeting** | primary_broker_id, secondary_broker_id?, meeting_date, tenant_name, sector?, contact_name, designation, client_phone_enc, client_email_enc (AES-256-GCM), meeting_type, temperature (`COLD`/`LUKEWARM`/`WARM`/`HOT`), mode, comments |
| **CabBooking** | car_type (`SEDAN` 4 seats / `SUV` 6 seats), client_name, pickup_date, pickup_time, pickup_location, booked_for_id ("Booked by"), created_by_id, status (`REQUESTED`/`CONFIRMED`/`COMPLETED`/`CANCELLED`), status_changed_by_id |
| **Invoice** | type (`INVOICE`/`PROFORMA`/`CREDIT_NOTE`), number (unique, e.g. `PM/26-27/0001`), fy, seq, status, issue_date, due_date, valid_until, payee_name, billing_address, gstin, place_of_supply, narration, payment_terms, mobile, email, fees/cgst/sgst/igst/total_paise, amount_paid_paise, lead_id?, converted_from_id?, credit_note_for_id?, pdf_key |
| **InvoiceBroker** | invoice_id, user_id **or** external_name, share_pct (totals 100), position |
| **DocumentSequence** | (kind, fy) PK, next_value — row-locked inside the issuing transaction ⇒ gap-free numbering |
| **Payment** | invoice_id, amount_paise, received_on, mode, reference, recorded_by_id |
| **LedgerEntry** | type (`INCOME`/`EXPENSE`), category, description, party, mode, amount_paise, entry_date, payment_id?, payroll_run_id? |
| **PayrollRun** | period (`YYYY-MM`, unique), status (`REVIEW`/`APPROVED`/`DISBURSED`), pay_date, approved_by/at, disbursed_by/at |
| **Payslip** | run_id, user_id, period, period_type (`MONTHLY`), gross/deductions/net_paise, components JSON, pdf_key; quarterly/yearly statements are aggregated on demand |
| **Folder** | key (`PM_DOCUMENTS`/`CLIENT_DOCUMENTS`/`EMPLOYEE_DOCUMENTS`), name |
| **File** | folder_id?, name, storage_key, size_bytes, mime, sha256, owner_user_id? (Employee Documents subject), invoice_id?, uploaded_by_id, scan_status |
| **Target** | scope (`COMPANY`/`PARTNER`/`USER`), scope_key, metric (`REVENUE`/`WIP_FEES`), period (`FY2026-27`, `FY2026-27-Q3`), amount_paise |
| **Achievement** | kind, user_id?, lead_id?, invoice_id?, title, meta, value_paise |
| **Notification** | user_id, kind, text, href, read_at |
| **AuditLog** | actor_id, actor_name, module, action, entity_type, entity_id, text, ip, user_agent, before, after, visibility, subject_user_ids uuid[], feed |
| **Setting** | key, value JSON (integration flags, editable preferences) |

Invoice rules: GST 18% — CGST 9% + SGST 9% when the buyer GSTIN's state code equals the company's (29, Karnataka),
otherwise IGST 18%. GSTIN validated by pattern **and** checksum. Issued invoices are immutable; corrections are
credit notes (`CN/26-27/0001`). Proforma → "Convert to invoice" copies the broker split and links both records.

---

## 6. Infrastructure

- **Docker**: multi-stage (`deps` → `build` → `runner`), non-root user, Chromium + fonts in the runner,
  `HEALTHCHECK` on `/api/health`, entrypoint runs `prisma migrate deploy` (optionally with a separate
  migration URL) and the idempotent seed, then `node server.js`.
- **Coolify on a Hostinger VPS**: app = Dockerfile resource; Coolify-managed PostgreSQL (internal network URL);
  MinIO as a second resource with a persistent volume and bucket versioning; domain + Let's Encrypt, force HTTPS,
  `www` → apex redirect; scheduled Postgres backups to S3. Full steps in `docs/DEPLOY.md`.
- **Security**: CSP with per-request nonce (`proxy.ts`), HSTS and the usual headers, Server Action origin check +
  explicit same-origin check on mutating route handlers, rate limits (login, upload, PDF) stored in Postgres,
  argon2id, encrypted PII, least-privilege DB role for runtime vs. migration role, dependency audit in CI.
- **Observability**: pino JSON logs with request ids, slow-query log (> 500 ms), `/api/health`, optional Sentry.
- **Storage addresses**: the app talks to MinIO on the internal network (`S3_ENDPOINT`) and signs 60-second
  download links for the address browsers use (`S3_PUBLIC_ENDPOINT`); production refuses to start with an internal
  endpoint and no public one.
- **CI**: GitHub Actions — typecheck, lint, unit tests, build, then Playwright e2e against a production build with
  Postgres, MinIO and Mailpit, `pnpm audit`; Coolify deploys `main` through its webhook.
- **Visual parity**: `pnpm parity` screenshots each prototype module and the same app screen (demo data) into
  `docs/parity/`.

---

## 7. Milestones

| # | Scope | Exit criteria |
|---|---|---|
| 1 | Repo scaffold, tokens, shell (top bar, rail, ⌘K, quick-create, notifications), login + intro animation, Auth.js + argon2 + forced password change + rate limit, RBAC (`can`, scopes, permissions table), audit log, env validation, Dockerfile, compose, Coolify notes | Signed-in "hello" build runs from the Docker image against Postgres |
| 2 | WIP (list, blue cards, drawer, remark changes), Teams/Users (cards, onboarding drawer, invite email), Dashboard (greeting, Target, Total Revenue + FY compare, Pipeline, To-do, team activity, achievements), employee dashboard | WIP rows persist with broker scoping; dashboards computed from data |
| 3 | Invoice / Proforma (gap-free numbering, GST split, broker split, documents, convert, credit note), print view + Chromium PDF + email with attachment, payments, Finance overview + XLSX/PDF export | Invoice → PDF → email works end to end |
| 4 | Payroll (runs, payslips, Monthly/Quarterly/Yearly PDFs), Contracts & Vault (folders, ACL, upload/scan/download), Vehicle Management, Business Development (encrypted contacts), Follow-ups & Tasks (agenda/week, list/board drag, drawer + comments) | All modules persist with RBAC |
| 5 | Settings (general, targets, roles grid, integrations stubs, audit log), notifications + reminders, achievements pop-up, polish, accessibility/Lighthouse, unit + e2e + visual-parity tests, README, DEPLOY, RUNBOOK | Definition of done in the brief |

Each milestone ends with a commit and a summary of what changed, how to run it, and what could not be verified.
