# Pat Michaels OS

Operating system for **Pat Michaels Developers LLP** — WIP, follow-ups, business development, cabs,
invoicing, finance, payroll, team and documents in one place.

- Design source of truth: `design-reference/Pat Michaels OS (offline).html`.
- Architecture, stack and data model: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- Production: [`docs/DEPLOY.md`](docs/DEPLOY.md) (Hostinger VPS + Coolify) and [`docs/RUNBOOK.md`](docs/RUNBOOK.md) (operations).
- Side-by-side screenshots of the prototype and the app: [`docs/parity/`](docs/parity/).
- Mobile app (Expo, iOS and Android): [`mobile/`](mobile/README.md). It uses this backend through
  `/api/mobile/v1` (bearer-token sign-in, the same services and server actions), so both apps share one
  database and one set of rules. Design source: `mobile.html`.

> Status: all five milestones. Foundation, WIP, Teams, Dashboard, Invoice/Proforma (PDF, print, email,
> payments and reversals, credit notes), Finance (XLSX/PDF export), Payroll, Contracts & Vault, Vehicle
> Management, Business Development, Follow-ups & Tasks, Settings (targets, roles & permissions, integrations,
> audit log), optional sign-in codes for owners/admins, unit and end-to-end tests, and the deployment docs.

## Quick start (local)

Requirements: Node 22.13+, pnpm 12 (`corepack enable`). Docker is optional.

```bash
pnpm install
cp .env.example .env          # then edit: see "Local .env" below
pnpm db:local                 # embedded PostgreSQL 17 on :54329 (no Docker needed) — leave running
pnpm db:migrate               # apply migrations
pnpm db:seed                  # owners, permission defaults, vault folders, targets
pnpm dev                      # http://localhost:3000
```

With Docker instead of `pnpm db:local`: `docker compose up -d db minio mailpit` (Postgres on :54329,
MinIO on :9000/:9001, Mailpit on :8025).

### Local .env

```dotenv
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:54329/patmichaels
AUTH_SECRET=<openssl rand -base64 32>
ENCRYPTION_KEY=<openssl rand -base64 32>
STORAGE_DRIVER=local      # dev only; use s3 with MinIO from docker compose to mirror production
MAIL_DRIVER=file          # dev only; emails are written to .local/mail
SEED_OWNER_PASSWORD=<temporary password for the seeded owners>
```

Sign in as `pat@patmichaels.in` with the temporary password; you'll be asked to choose a new one.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js dev server / production build / production server |
| `pnpm typecheck` · `lint` · `test` | TypeScript, ESLint, Vitest unit tests |
| `pnpm test:e2e` | Playwright end-to-end tests (see below) |
| `pnpm parity` | Regenerates `docs/parity/` from the prototype and a running app with demo data |
| `pnpm db:local` | Docker-less PostgreSQL 17 (data in `.local/pg`) |
| `pnpm db:migrate` · `db:deploy` | Create/apply migrations (dev) · apply migrations (prod) |
| `pnpm db:seed` | Idempotent production seed |
| `pnpm db:studio` | Prisma Studio |

## Tests

- **Unit** (`pnpm test`): money, GST/GSTIN, dates and financial years, WIP fees, invoice numbering and status,
  finance definitions, payroll arithmetic, permissions, schemas, storage link signing.
- **End to end** (`pnpm test:e2e`): sign-in (wrong password, first sign-in password change, sign-out,
  return to the requested page), **create a WIP lead → raise its invoice → print → server PDF → email with the
  PDF attached**, **an employee downloads their own payslip** but gets a 404 for anyone else's, **employee access
  control** (restricted pages show "Not available"; finance export, invoice PDFs, others' payslips and partner-folder
  uploads are refused), and **phones** (bottom bar, page list, sign-out, no sideways scrolling). They run
  against a production build and a throwaway database whose name must end in `_test` or `_e2e`. The global setup
  loads the demo data into it.

  ```bash
  pnpm build
  DATABASE_URL=postgresql://postgres:postgres@localhost:54329/patmichaels_e2e pnpm exec prisma migrate deploy
  NODE_ENV=test DATABASE_URL=postgresql://postgres:postgres@localhost:54329/patmichaels_e2e \
    STORAGE_DRIVER=local MAIL_DRIVER=file pnpm test:e2e
  ```

  CI runs the same suite against Postgres, MinIO and Mailpit, and checks that the invoice email arrives with its PDF.

## Roles

| Role | Access |
|---|---|
| **Owner** (partners) | Everything, including Settings, Payroll, Finance and the audit log |
| **Admin** | Everything except changing owners and role definitions |
| **Employee** | Own WIP rows, own tasks/follow-ups, own BD meetings (client contact info hidden), Vehicle Management, own payslips/CTC, own Employee Documents |

Permissions are enforced on the server (`src/server/policy`) and editable per role in Settings → Roles &
permissions (owners only). Settings also holds company and per-person **targets** (they drive the Dashboard,
WIP and Teams), the state of each **integration** (planned ones appear with `FEATURES=integrations-preview`),
and the **audit log**, filterable by module, with before/after values.

**Sign-in codes**: with `AUTH_OTP_FOR_ADMINS=true`, owners and admins enter a 6-digit code emailed after their
password. Codes expire after 10 minutes, work once, and are cancelled after 5 wrong tries. Employees sign in
with their password only.

## Finance definitions

Shared by the Dashboard, the Finance overview and its exports (`src/lib/finance.ts`):

- **Revenue** — fees (excl. GST) on tax invoices issued in the period, net of credit notes. Proformas are not revenue.
- **Expenses** — ledger expenses dated in the period. **Payroll** is the Salaries category (payroll runs post there).
- **Profit** — revenue + other income (ledger receipts not tied to an invoice payment) − expenses.
- **Collections** — receipts including GST. **Receivables** — unpaid today on invoices issued up to the period end.
- While a financial year is running, figures are year to date and compared with the same dates last year.

Invoice payments post to the ledger automatically; other income and expenses are added on Finance → Add entry
(or quick-create → Expense) and can be voided there with a reason (kept in the audit log).

## Payroll

One run per month: **Review → Approved → Disbursed** (owners/admins with *Run payroll*). Opening a run drafts a
payslip for everyone with a CTC (partners are not on payroll; joiners are prorated by days). In Review, the
Payslips drawer edits commission, incentive, TDS, other deductions, a note, or holds a payslip. Approval locks
the payslips; disbursal posts the gross salary cost to the ledger (Finance → Payroll) and emails each payslip.

Structure (`src/lib/payroll.ts`): CTC is gross fixed pay — Basic 50 %, HRA 20 %, Special allowance 30 %.
Deductions: employee PF 12 % of basic, Karnataka professional tax (₹ 200, ₹ 300 in February, from ₹ 25,000),
and a TDS estimate (10 % above ₹ 50,000 a month) that reviewers can override. Managers download anyone's
payslips from Payroll.

Employees have **Payslips & Incentive** instead: their own payslips (monthly, quarterly, yearly) and their
incentive per deal, also summarised on their dashboard. Incentive (`src/lib/incentive.ts`) is 20 % of the
person's share of each deal's fee: earned at Invoice Raised / Payment Collected, counted at half as expected
while the deal is in play, nothing for Lost / On Hold. The share comes from the invoice's broker split once
invoiced, otherwise the WIP row's share %, otherwise an equal split among its brokers. It is shown, not paid
automatically — add it to a payslip during payroll review.

## Documents

Uploads are checked by content (PDF, images, Office, ZIP, CSV/TXT only), size-limited (`UPLOAD_MAX_MB`),
virus-scanned when `CLAMAV_HOST` is set, and stored in S3/MinIO; downloads are 60-second signed URLs. Set
`S3_SSE=AES256` (with KMS configured on MinIO) to encrypt uploads at rest — the Vault only says "encrypted at
rest" when it is on. Employee Documents are visible to the employee they belong to and to people with
*All employee documents*.

## Demo data (development only)

`pnpm db:seed:demo` loads the design prototype's sample team, WIP rows, targets and to-dos (dates shifted so
they stay current) so screens can be compared side by side with `design-reference/`, plus invoices, proformas,
payments, credit notes, ledger entries and monthly payroll from the start of the previous financial year (the
current month open for review), cab bookings, BD meetings, tasks, follow-ups and vault documents. Each part only
runs when its tables are empty. It refuses to run with `NODE_ENV=production`. Demo users sign in with
`SEED_DEMO_PASSWORD` (default `Demo-Password-2026`), e.g. `neha@patmichaels.in` (employee) or
`anita@patmichaels.in` (admin).

To keep demo data apart from your working database, point `DATABASE_URL` at a separate database (for example
`…/patmichaels_demo`) when running `db:deploy`, `db:seed`, `db:seed:demo` and `pnpm dev`.

> **Design review needed:** the Dashboard **Pipeline** card was not in the prototype; it is built from
> existing components and should be reviewed by design.
