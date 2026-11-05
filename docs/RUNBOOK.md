# Pat Michaels OS — Runbook

Day-to-day operation of the production deployment described in [`DEPLOY.md`](DEPLOY.md). Commands that touch
the database are run from the Postgres resource's **Terminal** in Coolify (`psql -U postgres -d patmichaels`).

## Where to look first

| Question | Look at |
|---|---|
| Is it up? | `https://os.patmichaels.in/api/health`: `ok` with `db: ok`; `503 degraded` means the database is unreachable |
| What happened? | Coolify → app → **Logs**. JSON lines with `reqId`, `userId`, and slow queries (> `SLOW_QUERY_MS`) |
| Who did it? | In the app: Settings → **Audit log** (filter by module; before/after values for every change, downloads, sign-ins) |
| Are email and storage wired up? | Settings → **Integrations** (owners/admins) |
| Errors with stack traces | Sentry, if `SENTRY_DSN` is set |

## People and access

- **New member**: Teams → **+ Add member**. They get an invite email with a link to set their password.
  "Resend invite" is in their drawer.
- **Someone leaves**: Teams → open them → switch **Account active** off. They are signed out everywhere
  at once and can't sign in. Their records, payslips and audit history stay.
- **Forgotten password**: they use "Forgot password?" on the sign-in page (link valid for a limited time). Changing a
  password signs out their other devices.
- **"Too many attempts"**: sign-in is limited to 8 tries per email and 30 per IP address per 15 minutes. It
  clears on its own. To clear it sooner for one person:
  ```sql
  DELETE FROM rate_limits WHERE key = 'login:email:someone@patmichaels.in';
  ```
- **Sign-in codes for owners and admins**: on when `AUTH_OTP_FOR_ADMINS=true`. A code expires after 10 minutes, works once,
  and is cancelled after 5 wrong tries. A newer code replaces older ones. If codes don't arrive, see "Emails
  aren't arriving". In an emergency (mail down), set the variable to `false` and redeploy, then turn it back on.
  Google sign-in, when configured, relies on Google's own 2-step verification instead.
- **What each role may do**: Settings → Roles & permissions (owners only). Changes apply immediately and are audited.

## Money corrections (never edit these tables by hand)

| Mistake | Fix in the app |
|---|---|
| Wrong expense or income entry | Finance → Recent entries → the **×** on the row → **Void entry** (reason required), then add the correct one |
| Payment recorded against the wrong invoice or amount | Open the invoice → **Payments (n)** → **Reverse** (reason required). The invoice, Finance and the WIP stage update together. |
| Invoice amount wrong after issue | **Credit note** against it, then raise a new invoice. Issued invoices are never edited. |
| Payslip wrong before approval | Payroll → Payslips → edit. After approval it is locked. Correct it in the next month's run (incentive or other deduction) with a note. |

## Background jobs (emails, reminders, nightly clean-up)

Jobs live in the database (pg-boss, schema `pgboss`) and are processed inside the app container
(`WORKER_ENABLED=true`). Run exactly one container with the worker on. Failed emails retry six times with
back-off over about half an hour.

```sql
-- Queue overview
SELECT name, state, count(*) FROM pgboss.job GROUP BY 1, 2 ORDER BY 1, 2;
-- Latest failures with the error
SELECT name, created_on, output FROM pgboss.job WHERE state = 'failed' ORDER BY created_on DESC LIMIT 20;
```

## Incidents

**App down / 502**
1. `/api/health`: if it reports `db: unreachable`, check the Postgres resource is running (Coolify) and has disk space.
2. App logs: an `Invalid environment configuration` block lists exactly which variable is wrong.
3. Restart the app from Coolify. If the last deploy caused it, redeploy the previous deployment (DEPLOY → Rolling back).

**Emails aren't arriving** (invites, invoices, payslips, sign-in codes)
1. Settings → Integrations → Email delivery shows the SMTP host in use.
2. Run the failure query above. `output` holds the SMTP error, e.g. authentication or rate limit at the provider.
3. Check spam, and that SPF/DKIM/DMARC records exist (DEPLOY → DNS).
4. After fixing credentials and redeploying, failed jobs aren't re-sent automatically. Ask people to repeat the action
   ("Email" on the invoice, "Resend invite", sign in again for a new code).

**PDF download fails** ("couldn't render")
- Logs show the Chromium error. The image ships Chromium at `/usr/bin/chromium` (`CHROMIUM_PATH`).
- Usually memory: give the app container at least 1.5–2 GB.
- PDFs are rendered from the app's own `/print/...` pages over `INTERNAL_APP_URL` (default `http://127.0.0.1:3000`).
  Leave it empty unless the app listens on another port.

**Uploads fail**
- A general upload error with an S3 error in the logs: MinIO down, or wrong `S3_*` credentials (the app user
  needs the bucket policy from DEPLOY step 5).
- A message about the file type or size: working as designed (`UPLOAD_MAX_MB`, content checks).
- "The virus scanner is unavailable": with `CLAMAV_HOST` set, uploads are refused while ClamAV is unreachable.
  Fix ClamAV, or unset the variable and redeploy to accept uploads unscanned for the time being.

**Downloads fail** (Vault file opens an error page)
- Links point at `S3_PUBLIC_ENDPOINT`. That domain must reach MinIO's API (port 9000) with HTTPS.
- `SignatureDoesNotMatch` means the public domain differs from `S3_PUBLIC_ENDPOINT`, or a proxy rewrote the Host header.
- `Request has expired`: the VPS clock is off (`timedatectl`; enable NTP), or the link was opened after 60 seconds.

**Disk full**
- `df -h` on the VPS; usually Docker images or local backups. `docker system prune -a` (keeps running
  containers), and lower the local backup retention in Coolify.

## Backups and restore

What exists (set up in DEPLOY):
- Daily Postgres dump (Coolify), 14 kept locally, copies in the off-site S3 bucket.
- MinIO bucket versioning (deleted or overwritten files are recoverable) plus a nightly mirror off-site.

**Restore a deleted Vault file** (deletion in the app is a soft delete; the object gets a delete marker):
```bash
mc ls --versions pm/pat-michaels-os/<key>        # key is in the audit log entry for the deletion
mc cp --version-id <id> pm/pat-michaels-os/<key> pm/pat-michaels-os/<key>
```
Then clear `deleted_at` on that row in `files` (or upload it again).

**Restore the database** (after data loss or corruption):
1. Stop the app in Coolify, so nothing writes.
2. Download the chosen dump from the off-site bucket or Coolify's backup list, and copy it into the Postgres container.
3. Restore into a fresh database, then swap names:
   ```bash
   psql -U postgres -c "CREATE DATABASE patmichaels_restore OWNER pm_owner"
   pg_restore -U postgres -d patmichaels_restore --no-owner --role=pm_owner <dump-file>
   psql -U postgres -c "ALTER DATABASE patmichaels RENAME TO patmichaels_broken"
   psql -U postgres -c "ALTER DATABASE patmichaels_restore RENAME TO patmichaels"
   ```
4. Re-apply the grants from DEPLOY step 4 (the `GRANT … ON ALL TABLES` lines and the `pgboss` schema
   ownership), because a restore with `--no-owner` doesn't carry them.
5. Start the app and check `/api/health`, a recent invoice, and today's audit log.
6. Drop `patmichaels_broken` once you are sure.

**Restore drill**: once a month, restore last night's dump into `patmichaels_restore` and spot-check it
(counts of invoices, ledger entries and files against the live app), then drop it. An untested backup isn't a backup.

## Rotating secrets

| Secret | Effect of rotating | How |
|---|---|---|
| `AUTH_SECRET` | Everyone is signed out; open print links stop working | New value in Coolify → redeploy |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Open tabs need a reload | New value → redeploy |
| `ENCRYPTION_KEY` | Client phone and email on BD meetings are encrypted with it | See below |
| SMTP password | — | Change at the provider, update `SMTP_PASSWORD`, redeploy |
| Storage key | — | `mc admin user add pm pm-app '<new>'` (updates the secret), update `S3_SECRET_ACCESS_KEY`, redeploy |
| Database passwords | — | `ALTER ROLE pm_app PASSWORD '…'`, update `DATABASE_URL` (and the owner equivalents), redeploy |

**`ENCRYPTION_KEY`**: stop the app, then from a machine that can reach the database (or a one-off container
from the app image):

```bash
OLD_ENCRYPTION_KEY=<current> NEW_ENCRYPTION_KEY=$(openssl rand -base64 32) \
MIGRATION_DATABASE_URL=postgresql://pm_owner:…@<db-host>:5432/patmichaels \
  pnpm exec tsx scripts/rotate-encryption-key.ts --dry-run   # proves the old key opens everything
# then the same without --dry-run; it re-encrypts everything in one transaction
```

Set the new value as `ENCRYPTION_KEY` and start the app. Keep the old key until you've checked a BD meeting
shows its contact details.

## Upgrades and known quirks

- **Dependencies** are pinned. Upgrade on a branch, then let CI (unit + e2e) pass before merging.
- **Local development**: background jobs (emails, reminders) start once with `pnpm dev` and don't hot-reload — restart
  the dev server after changing anything under `src/server/queue`, `reminders.ts` or the email/PDF code. If the dev
  server keeps reloading the page in a loop, stop it, delete `.next/dev` and start it again.
- Server Action logging is switched off in `next.config.ts` (`logging.serverFunctions: false`): Next.js would otherwise
  print every action's arguments — including passwords — in the dev terminal. Don't switch it back on.
- Keep **`pg` on 8.x**. Prisma 7.10's query engine sends overlapping queries inside transactions, which pg 8
  only warns about (`DeprecationWarning: Calling client.query() when the client is already executing a query`)
  and pg 9 will reject. Upgrade `pg` only once Prisma supports it.
- Locally, `next start` warns that it "does not work with output: standalone". The e2e tests use it anyway and it works.
  Production runs `node server.js` from the standalone build in Docker.
- The demo seed (`pnpm db:seed:demo`) refuses to run with `NODE_ENV=production`. Never point it at the production database.
- **The Docker image only has what tracing copied into `.next/standalone`**, while the e2e specs run through `next start`,
  which sees all of `node_modules`. A package that loads a file by a computed path works in tests and fails in production
  unless the file is listed under `outputFileTracingIncludes` in `next.config.ts` (today: Playwright's `browsers.json`).
  CI's "Production start-up" step starts the standalone output with the restricted database role to catch this.
- A `pnpm build` on a dev machine also copies `.local` (dev mail and uploads) into `.next/standalone`. `.dockerignore` keeps
  it out of the image; don't deploy a standalone folder built by hand.
- `pnpm-workspace.yaml` overrides `uuid` (under exceljs), `glob` (under Sentry's build plugin) and `minimatch` (under
  typescript-eslint) for security fixes the parents haven't picked up. When upgrading those parents, try removing the
  overrides and run `pnpm audit`. The `nodemailer` peer rule is there because Auth.js's unused email provider asks for v8.
