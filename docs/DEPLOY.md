# Deploying Pat Michaels OS — Hostinger VPS + Coolify

This guide takes a fresh Hostinger VPS to a running `https://os.patmichaels.in`. Day-to-day operations
(backups, restores, incidents, secret rotation) are in [`RUNBOOK.md`](RUNBOOK.md).

**There is no separate frontend to build or upload.** This is one Next.js application: pages, API routes and background
jobs run in a single Node.js server, and every screen needs that server (sign-in, permissions, data). Coolify builds it
from GitHub with the repository's `Dockerfile`. Nothing is uploaded by hand, and Coolify has no upload option anyway: its
sources are Git, a container image, or a pasted Dockerfile or Compose file. The browser calls the API on its own address,
so there is no backend URL to configure.

**What runs where**

| Piece | How | Reachable from the internet |
|---|---|---|
| App (UI, API and job workers, plus Chromium for PDFs) | Coolify *Application*, built from this repo's `Dockerfile` | `https://os.patmichaels.in` |
| PostgreSQL 17 | Coolify *Database* | No — internal network only |
| MinIO (S3 storage for uploads and PDFs) | Coolify *Docker Compose* service | API only, at `https://files.patmichaels.in`. The bucket stays private; downloads use 60-second signed links |
| Email | Hostinger mailbox over SMTP (or Resend) — [can wait](#running-without-email) | — |
| ClamAV (optional upload scanning) | Coolify *Service* | No |

On every start the container applies database migrations, runs the idempotent seed (owners, permission
defaults, vault folders, targets) and then starts the server. Neither step deletes data. `/api/health` reports app and
database status. The app keeps nothing on its own disk: all data lives in the Postgres and MinIO volumes.

---

## 1. VPS

Recommended: **Hostinger KVM 2** (2 vCPU, 8 GB RAM, 100 GB NVMe) or larger, **Ubuntu 24.04 LTS**, in the
India location if offered. 4 GB RAM works, but image builds are slow and need the swap below.

Sign in as root with the password from hPanel once, then:

```bash
# A sudo user that signs in with an SSH key
adduser deploy && usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ 2>/dev/null; nano /home/deploy/.ssh/authorized_keys   # paste your public key
chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys

# Keys only, no root password logins (test the deploy login in a second terminal first)
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart ssh

# 4 GB swap (image builds peak above 4 GB)
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Firewall: SSH, HTTP, HTTPS (+ the Coolify dashboard until it has its own domain)
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 8000/tcp
ufw enable

# Automatic security updates
apt update && apt install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades
```

> **Docker ignores ufw for published ports.** Never give the database or MinIO a "public port" in Coolify.

## 2. DNS

At the DNS provider for `patmichaels.in`, add **A** records pointing at the VPS IP:

| Name | Purpose |
|---|---|
| `os` | the app |
| `files` | MinIO API (uploads and signed download links) |
| `coolify` | the Coolify dashboard |

Add them before step 5: certificates are issued as soon as a domain is set.

## 3. Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

1. Open `http://<vps-ip>:8000` **straight away** and create the admin account. The first visitor becomes the admin.
2. Settings → General → **Instance domain** `https://coolify.patmichaels.in`. Coolify requests a certificate.
3. Enable two-factor authentication on the admin account (Profile → Two-factor).
4. Close the temporary port: `sudo ufw delete allow 8000/tcp`.
5. Create a **Project** "Pat Michaels OS" with an environment "production". Everything below goes in it.

Coolify's menus change between versions, so a label may differ slightly from the ones here.

## 4. PostgreSQL

**+ New → Database → PostgreSQL**, version 17. Leave "Make it publicly available" **off**. Start it.

The app connects with two roles:
- **`pm_owner`** owns the schema and runs migrations (`MIGRATION_DATABASE_URL`).
- **`pm_app`** is the runtime role, limited to reading and writing rows (`DATABASE_URL`). It can't drop or
  alter tables. It owns only the `pgboss` schema, where the background job queue keeps and migrates its own tables.

Open the database's **Terminal** in Coolify, run `psql -U postgres`, and paste the SQL below. Replace both passwords with
long random values from `openssl rand -hex 24`. Use hex: `/` or `+` in a password breaks the connection string.

```sql
CREATE ROLE pm_owner LOGIN PASSWORD 'CHANGE_ME_OWNER';
CREATE ROLE pm_app   LOGIN PASSWORD 'CHANGE_ME_APP';
CREATE DATABASE patmichaels OWNER pm_owner;
REVOKE ALL ON DATABASE patmichaels FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE patmichaels TO pm_app;

\c patmichaels
ALTER SCHEMA public OWNER TO pm_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO pm_app;
-- Tables and sequences that migrations create later are readable/writable by the app, nothing more.
ALTER DEFAULT PRIVILEGES FOR ROLE pm_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pm_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pm_app;
-- The job queue (pg-boss) creates and upgrades its own tables here.
CREATE SCHEMA pgboss AUTHORIZATION pm_app;
```

If migrations already ran as another role, give the app access to the existing tables too:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pm_app;
```

Note the database's **internal hostname** from its Coolify page (a long id). The connection strings are:

```
DATABASE_URL=postgresql://pm_app:CHANGE_ME_APP@<db-internal-host>:5432/patmichaels
MIGRATION_DATABASE_URL=postgresql://pm_owner:CHANGE_ME_OWNER@<db-internal-host>:5432/patmichaels
```

There is no migration step to run by hand: the app container applies them on every start, as `pm_owner`.

**Backups** (database page → Backups): enable a scheduled backup every day at 02:30 (`30 2 * * *`, server
time), keep 14 locally, and send them to an **S3 destination off the VPS**. Add the destination first under
Coolify → Storages, e.g. Hostinger Object Storage, AWS S3 `ap-south-1` or Backblaze B2. A backup on the same
disk doesn't survive losing the VPS. The restore procedure is in the runbook.

## 5. MinIO

MinIO is no longer in Coolify's one-click list, so it runs from a Compose definition. CI tests the app against this exact
image. MinIO's authors no longer maintain the open-source edition; the app only speaks S3, so moving to another provider
later takes new `S3_*` values and a copy of the bucket, not a code change.

**+ New → Docker Compose Empty**, and paste:

```yaml
services:
  minio:
    image: ghcr.io/coollabsio/minio:RELEASE.2025-10-15T17-29-55Z
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ROOT_USER}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
    volumes:
      - minio-data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 10
```

Then, before starting it:

- **Environment Variables**: set `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` (`openssl rand -hex 24`). They are for
  administration only; the app gets its own user below.
- **Domains**: add a domain for the `minio` service, including the internal port: `https://files.patmichaels.in:9000`.
  Don't give the console (9001) a domain.
- To encrypt uploads at rest, also add `MINIO_KMS_SECRET_KEY=pm-os-key:<base64 of 32 random bytes>`
  (`openssl rand -base64 32`) and pass it through in `environment`. **Store this key in the password manager too.** Without
  it, every stored file becomes unreadable. Then set `S3_SSE=AES256` on the app and add `mc encrypt set sse-s3 pm/pat-michaels-os`
  to the commands below. This is optional for the first deploy.

Start it, open its **Terminal** and create the bucket plus an app user that can touch only that bucket:

```bash
mc alias set pm http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb pm/pat-michaels-os
mc version enable pm/pat-michaels-os          # deleted files stay recoverable
cat > /tmp/pm-app.json <<'EOF'
{ "Version": "2012-10-17", "Statement": [
  { "Effect": "Allow", "Action": ["s3:GetBucketLocation", "s3:ListBucket"], "Resource": ["arn:aws:s3:::pat-michaels-os"] },
  { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": ["arn:aws:s3:::pat-michaels-os/*"] }
] }
EOF
mc admin policy create pm pm-app /tmp/pm-app.json
mc admin user add pm pm-app 'CHANGE_ME_STORAGE_SECRET'
mc admin policy attach pm pm-app --user pm-app
```

The app reaches MinIO at its public HTTPS address. Coolify Services are on their own network by default, so this avoids a
shared-network setting and uses the same route as the download links. The bucket has no public policy: a link works for 60
seconds and nothing is listable.

**Off-site copy of files**: Postgres backups don't include uploads. Schedule a nightly mirror of the bucket
to the same off-site S3 provider (Coolify → Scheduled tasks on the MinIO service, or cron on the host):

```bash
mc alias set offsite https://<offsite-endpoint> <key> <secret>
mc mirror --overwrite --remove=false pm/pat-michaels-os offsite/pat-michaels-os-backup
```

## 6. The app

**+ New → Application**, and pick the repository: **Private Repository (GitHub App)** if it's private, which it should be,
or **Public Repository** with its URL. Branch `main`. Then:

| Setting | Value |
|---|---|
| Build pack | **Dockerfile** |
| Base Directory | `/` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `3000` |
| Domains | `https://os.patmichaels.in` |
| Advanced → Build → Build arguments | **Managed manually in Dockerfile** |
| Healthcheck | Leave it: Coolify uses the image's `HEALTHCHECK`, which calls `/api/health` |
| Resource limits | Memory 2 GB is comfortable (Chromium renders PDFs inside the container) |

**Environment variables**: open Environment Variables → **Developer view** and paste them in this form:

```
# coolify: literal buildtime=false
APP_URL=https://os.patmichaels.in
```

**Set every variable to runtime only** (`buildtime=false`, or "Not available during build" in Normal view). New variables
default to available during the build, where secrets can end up in image metadata. There's no need to set `NODE_ENV`: the
image already runs in production mode.

| Variable | Required | Value |
|---|---|---|
| `APP_URL` | Yes | `https://os.patmichaels.in`. Used in links and cookies |
| `DATABASE_URL` | Yes | `pm_app` connection string from step 4 |
| `MIGRATION_DATABASE_URL` | Yes | `pm_owner` connection string from step 4 |
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | Yes | `openssl rand -base64 32`. Encrypts client contacts: **losing it loses them**, so keep a copy in the password manager |
| `S3_ENDPOINT` | Yes | `https://files.patmichaels.in` |
| `S3_BUCKET` | Yes | `pat-michaels-os` |
| `S3_ACCESS_KEY_ID` | Yes | `pm-app` |
| `S3_SECRET_ACCESS_KEY` | Yes | the secret from step 5 |
| `SMTP_HOST` | Yes | Real host, or `smtp.invalid` [while email waits](#running-without-email) |
| `AUTH_OTP_FOR_ADMINS` | Yes | `false` until email works, or owners and admins can't sign in. Then `true` |
| `COMPANY_BANK_NAME`, `COMPANY_BANK_ACCOUNT_NAME`, `COMPANY_BANK_ACCOUNT_NUMBER`, `COMPANY_BANK_IFSC` | Yes | Printed on invoices. **The app won't start without them** |
| `COMPANY_LEGAL_NAME`, `COMPANY_GSTIN`, `COMPANY_RERA`, `COMPANY_ADDRESS`, `COMPANY_PHONE`, `COMPANY_EMAIL`, `COMPANY_WEBSITE`, `COMPANY_PAN`, `COMPANY_BANK_BRANCH` | Check | Printed on invoices. Without them the app uses the values in `.env.example`, which came from the design prototype: set the real ones before the first invoice |
| `SEED_OWNER_PASSWORD` | First deploy | A temporary password for the owners' first sign-in. Remove it after step 7 |
| `SEED_OWNERS` | Optional | Who gets an owner account. Default: `Pat Michaels <pat@patmichaels.in>;Arjun Rao <arjun@patmichaels.in>` |
| `S3_SSE` | Optional | `AES256` only if MinIO has `MINIO_KMS_SECRET_KEY`; the Vault then shows "encrypted at rest" |
| `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | With email | Hostinger: `smtp.hostinger.com`, `465`, `SMTP_SECURE=true`, mailbox user and password |
| `CLAMAV_HOST` | Optional | The ClamAV service's address, if you add one |
| `SENTRY_DSN` | Optional | Error reporting |

The full list is in [`.env.example`](../.env.example). The app validates all of this at start and stops with a readable list
if something is missing or inconsistent. For example, it refuses an internal `S3_ENDPOINT` without `S3_PUBLIC_ENDPOINT`,
local storage, or file-based mail in production.

## 7. First deploy

1. Press **Deploy** and watch the logs. You should see `[entrypoint] applying database migrations`, then
   `running idempotent seed` with `Created owner …` lines, then `Pat Michaels OS starting` and `job workers started`.
2. Open `https://os.patmichaels.in/api/health`. It should show `{"status":"ok","db":"ok",…}`.
3. Sign in as each owner with the temporary password. The app asks for a new one immediately.
4. Remove `SEED_OWNER_PASSWORD` from the environment and restart. The seed never resets an existing
   password, but the temporary one shouldn't stay stored anywhere.

**After deployment, check:**

- [ ] `https://os.patmichaels.in` shows a valid certificate, and `http://` redirects to `https://`.
- [ ] Every item in the left rail opens without an error, as an owner and as an employee.
- [ ] Settings → Integrations shows document storage as **Connected**.
- [ ] Raise a test proforma, then **Download PDF**: it has the logo and the company's details.
- [ ] Upload a file in the Vault, download it, and delete it.
- [ ] Finance → export both XLSX and PDF.
- [ ] Add a test member and sign in as them (with no email yet, see below).
- [ ] Restart the app in Coolify: your test records and the file are still there.
- [ ] `https://files.patmichaels.in/pat-michaels-os/` from a browser is refused, not a file listing.
- [ ] The database has no public port, and the MinIO console has no domain.
- [ ] Logs show no `"level":50` lines other than expected email failures.
- [ ] The database backup has run once and shows in Coolify.
- [ ] An uptime monitor (e.g. UptimeRobot or Better Stack) watches `/api/health`.

**If it fails:**

| Symptom | Cause |
|---|---|
| Build stops at `next build`, or is killed | Out of memory: check the swap from step 1 |
| Container exits, log says `Invalid environment configuration` | The log lists exactly which variables to fix |
| `permission denied` in the migration step | The SQL in step 4 wasn't run, or the URLs use the wrong role |
| "No available server" | The container is unhealthy or not started: read its logs |
| PDF or upload errors mentioning storage | `files.` domain not resolving yet, or the `S3_*` values don't match step 5 |

## Running without email

The app can go live before email is set up, with these settings:

- `SMTP_HOST=smtp.invalid`. The app requires a mail host at start, and this address can never resolve.
- `AUTH_OTP_FOR_ADMINS=false`. **Required**: with sign-in codes on, owners and admins can't sign in without email.

What changes until email is on:

- Nothing is delivered: invoices and payslips by email, invites, password resets, reminders. In-app notifications and
  PDF downloads still work.
- The app can't tell mail is off, so it still says things like "welcome email sent", Settings still shows email as
  "Connected", and the logs show `job failed` for each attempt. All of that is expected, and the failed mail is never sent later.

**Getting a new member signed in.** Add them in Teams as usual, then read their invite link from the job queue in the
database's Terminal (`psql -U postgres patmichaels`) and send it to them yourself. Password resets work the same way:

```sql
SELECT data->>'to' AS person, data->>'subject' AS subject,
       substring(data->>'text' FROM 'https?://[^[:space:]]+') AS link
FROM pgboss.job
WHERE name = 'email-send' AND data->>'subject' ~* 'invited|reset'
ORDER BY created_on DESC LIMIT 20;
```

**Turning email on later**: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM`, then
restart. Add the SPF, DKIM and DMARC records that Hostinger Email shows in hPanel → Emails → DNS settings, or invoices
and payslips will land in spam. Once a test invoice email arrives, set `AUTH_OTP_FOR_ADMINS=true` and restart.

## 8. Continuous deployment

`.github/workflows/ci.yml` runs typecheck, lint, unit tests and a dependency audit on every push. It then builds the same
image Coolify builds and runs the Playwright suite against it, with the restricted database role, MinIO and Mailpit. On
`main` it then calls the Coolify deploy webhook.

- Coolify app → Webhooks: copy the **Deploy webhook** URL, and create an API token (Keys & Tokens) with deploy permission.
- GitHub → Settings → Secrets → Actions: add `COOLIFY_WEBHOOK` and `COOLIFY_TOKEN`.
- Turn **off** Coolify's own auto-deploy on push, so only commits that passed CI go live.

## 9. Updating and rolling back

- **Update**: merge to `main`. CI deploys; the container migrates the database on start. If a migration
  fails, the container exits before serving, and Coolify keeps the previous container.
- **Roll back the app**: Coolify app → Deployments → pick the previous successful deployment → **Redeploy**.
  Migrations only move forward. So far they only add tables and columns, so older code still runs against the
  newer database; check that holds before rolling back past a migration that removes or renames something.
- **Roll back data**: only for a damaged database. Restore last night's backup (runbook → Restore).

## 10. Security checklist

- [ ] SSH keys only; root password login off; ufw on (22, 80, 443).
- [ ] Coolify admin has 2FA; dashboard only at `https://coolify.patmichaels.in`.
- [ ] GitHub repository is private.
- [ ] Postgres and MinIO have no public ports; MinIO console has no domain.
- [ ] App uses `pm_app` (row access only); migrations use `pm_owner`.
- [ ] MinIO app user limited to the one bucket; bucket versioned and private.
- [ ] All secrets only in Coolify and the password manager; `SEED_OWNER_PASSWORD` removed after first sign-in.
- [ ] Every app variable is runtime only.
- [ ] Daily database backup off the VPS, nightly bucket mirror, and a restore tested (runbook).
- [ ] Once email works: `AUTH_OTP_FOR_ADMINS=true`, and SPF/DKIM/DMARC records in place.
