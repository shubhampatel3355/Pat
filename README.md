# Pat Michaels OS

Operating system for **Pat Michaels Developers LLP** — WIP, follow-ups, business development, cabs,
invoicing, finance, payroll, team and documents in one place.

- Design source of truth: `design-reference/Pat Michaels OS (offline).html` (unpacked copy in `design-reference/unpacked/`).
- Architecture, stack and data model: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

> Status: milestones 1–2 — foundation, WIP, Teams and Dashboard. Invoicing, finance, payroll, vault, vehicles, business development, tasks and settings arrive in milestones 3–5.

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
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm db:local` | Docker-less PostgreSQL 17 (data in `.local/pg`) |
| `pnpm db:migrate` · `db:deploy` | Create/apply migrations (dev) · apply migrations (prod) |
| `pnpm db:seed` | Idempotent production seed |
| `pnpm db:studio` | Prisma Studio |

## Roles

| Role | Access |
|---|---|
| **Owner** (partners) | Everything, including Settings, Payroll, Finance and the audit log |
| **Admin** | Everything except changing owners and role definitions |
| **Employee** | Own WIP rows, own tasks/follow-ups, own BD meetings (client contact info hidden), Vehicle Management, own payslips/CTC, own Employee Documents |

Permissions are enforced on the server (`src/server/policy`) and editable per role in Settings → Roles & permissions.

## Demo data (development only)

`pnpm db:seed:demo` loads the design prototype's sample team, WIP rows, targets and to-dos (dates shifted so
they stay current) so screens can be compared side by side with `design-reference/`. It refuses to run with
`NODE_ENV=production`. Demo users sign in with `SEED_DEMO_PASSWORD` (default `Demo-Password-2026`),
e.g. `neha@patmichaels.in` (employee) or `anita@patmichaels.in` (admin).

> **Design review needed:** the Employee dashboard (own target, own pipeline, today's follow-ups, upcoming
> cabs) and the Dashboard **Pipeline** card were not in the prototype; both are built from existing
> components and should be reviewed by design.
