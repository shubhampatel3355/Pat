# Deploying Pat Michaels OS — Hostinger VPS + Coolify

This guide takes a fresh Hostinger VPS to a running `https://os.patmichaels.in`. Day-to-day operations
(backups, restores, incidents, secret rotation) are in [`RUNBOOK.md`](RUNBOOK.md).

**What runs where**

| Piece | How | Reachable from the internet |
|---|---|---|
| App (Next.js + Chromium for PDFs) | Coolify *Application*, built from this repo's `Dockerfile` | `https://os.patmichaels.in` |
| PostgreSQL 17 | Coolify *Database* | No — internal network only |
| MinIO (S3 storage for uploads and PDFs) | Coolify *Service* | API only, at `https://files.patmichaels.in`, for 60-second signed download links. The bucket stays private. |
| Email | Hostinger mailbox over SMTP (or Resend) | — |
| ClamAV (optional upload scanning) | Coolify *Service* | No |

On every start the container applies database migrations, runs the idempotent seed (owners, permission
defaults, vault folders, targets) and then starts the server. `/api/health` reports app and database status.

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
> Reach them only by their internal hostnames, or through an SSH tunnel for maintenance.

## 2. DNS

At the DNS provider for `patmichaels.in`, add **A** records pointing at the VPS IP:

| Name | Purpose |
|---|---|
| `os` | the app |
| `files` | MinIO API (signed download links) |
| `coolify` | the Coolify dashboard |

For email from `no-reply@patmichaels.in`, make sure the domain has the SPF, DKIM and DMARC records that
Hostinger Email shows in hPanel → Emails → DNS settings, or invoices and payslips will land in spam.

## 3. Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

1. Open `http://<vps-ip>:8000` **straight away** and create the admin account. The first visitor becomes the admin.
2. Settings → General → **Instance domain** `https://coolify.patmichaels.in`. Coolify requests a certificate.
3. Enable two-factor authentication on the admin account (Profile → Two-factor).
4. Close the temporary port: `sudo ufw delete allow 8000/tcp`.
5. Create a **Project** "Pat Michaels OS" with an environment "production". Everything below goes in it,
   so the resources share Coolify's internal network.

## 4. PostgreSQL

**+ New → Database → PostgreSQL**, image `postgres:17-alpine`. Leave "Make it publicly available" **off**. Start it.

The app connects with two roles:
- **`pm_owner`** owns the schema and runs migrations (`MIGRATION_DATABASE_URL`).
- **`pm_app`** is the runtime role, limited to reading and writing rows (`DATABASE_URL`). It can't drop or
  alter tables. It owns only the `pgboss` schema, where the background job queue keeps and migrates its own tables.

Open the database's **Terminal** in Coolify, run `psql -U postgres`, and paste the SQL below. Replace both
passwords with long random values (`openssl rand -base64 24`).

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

**Backups** (database page → Backups): enable a scheduled backup every day at 02:30 (`30 2 * * *`, server
time), keep 14 locally, and send them to an **S3 destination off the VPS**. Add the destination first under
Coolify → Storages, e.g. Hostinger Object Storage, AWS S3 `ap-south-1` or Backblaze B2. A backup on the same
disk doesn't survive losing the VPS. The restore procedure is in the runbook.

## 5. MinIO

**+ New → Service → MinIO**. In its settings:

- Set strong `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` (they are only for administration, not for the app).
- Domain for the **API** (port 9000): `https://files.patmichaels.in`. Don't give the console (9001) a domain;
  use the Coolify terminal or an SSH tunnel when you need it.
- To encrypt uploads at rest, add `MINIO_KMS_SECRET_KEY=pm-os-key:<base64 of 32 random bytes>`
  (`openssl rand -base64 32`). **Store this key in the password manager too.** Without it, every stored file
  becomes unreadable. MinIO calls this single-key mode. It suits one server; MinIO KES is the multi-server option.

Start it, open its **Terminal** and create the bucket plus an app user that can touch only that bucket. If the
image has no `mc` client, run the same commands from a machine that has it, through an SSH tunnel to port 9000:

```bash
mc alias set pm http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb pm/pat-michaels-os
mc version enable pm/pat-michaels-os          # deleted files stay recoverable
mc encrypt set sse-s3 pm/pat-michaels-os      # only if MINIO_KMS_SECRET_KEY is set
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

Note MinIO's internal hostname from its Coolify page. The app uploads over the internal network
(`S3_ENDPOINT`) and signs download links for the public address (`S3_PUBLIC_ENDPOINT`). The bucket has no
public policy, so a link works for 60 seconds and nothing is listable.

**Off-site copy of files**: Postgres backups don't include uploads. Schedule a nightly mirror of the bucket
to the same off-site S3 provider (Coolify → Scheduled tasks on the MinIO service, or cron on the host):

```bash
mc alias set offsite https://<offsite-endpoint> <key> <secret>
mc mirror --overwrite --remove=false pm/pat-michaels-os offsite/pat-michaels-os-backup
```

## 6. The app

**+ New → Application → GitHub** (install the Coolify GitHub App on the repository), branch `main`:

- Build pack **Dockerfile**, port **3000**.
- Domain `https://os.patmichaels.in`. Coolify forces HTTPS and renews the certificate.
- Health check: path `/api/health`, port 3000.
- Resource limits: memory 2 GB is comfortable (Chromium renders PDFs inside the container).
- Optional: add a build variable `APP_VERSION` (e.g. the release tag) so `/api/health` and the logs show what is live.

**Environment variables**: start from [`.env.example`](../.env.example). Set every `CHANGE_ME` and keep them
only in Coolify, never in the repository. The essentials:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://os.patmichaels.in` |
| `DATABASE_URL` / `MIGRATION_DATABASE_URL` | from step 4 |
| `AUTH_SECRET`, `ENCRYPTION_KEY`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | each `openssl rand -base64 32`, kept in the password manager |
| `AUTH_OTP_FOR_ADMINS` | `true` recommended: owners and admins confirm sign-in with an emailed 6-digit code |
| `STORAGE_DRIVER` | `s3` |
| `S3_ENDPOINT` | `http://<minio-internal-host>:9000` |
| `S3_PUBLIC_ENDPOINT` | `https://files.patmichaels.in` |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | `pat-michaels-os`, `pm-app`, the secret from step 5 |
| `S3_SSE` | `AES256` only if MinIO has `MINIO_KMS_SECRET_KEY`; the Vault then shows "encrypted at rest" |
| `MAIL_DRIVER`, `SMTP_*`, `MAIL_FROM` | Hostinger: `smtp.hostinger.com`, `465`, `SMTP_SECURE=true`, mailbox user and password |
| `COMPANY_*` | printed on invoices. **Bank details** are required. Legal name, GSTIN, RERA, address and phone fall back to the values in `.env.example`, which came from the design prototype: set the real ones before the first invoice |
| `SEED_OWNERS` | `Pat Michaels <pat@patmichaels.in>;Arjun Rao <arjun@patmichaels.in>` |
| `SEED_OWNER_PASSWORD` | a temporary password for the first sign-in (remove it after step 7) |
| `CLAMAV_HOST` | the ClamAV service's internal host, if you add one (image `clamav/clamav:stable`, port 3310) |
| `SENTRY_DSN` | optional error reporting |

The app validates all of this at start and stops with a readable list if something is missing or
inconsistent. For example, it refuses an internal `S3_ENDPOINT` without `S3_PUBLIC_ENDPOINT`, local storage, or
file-based mail in production.

## 7. First deploy

1. Press **Deploy** and watch the logs. You should see `[entrypoint] applying database migrations`, then
   `running idempotent seed` with `Created owner …` lines, then `Pat Michaels OS starting` and `job workers started`.
2. Open `https://os.patmichaels.in/api/health`. It should show `{"status":"ok","db":"ok",…}`.
3. Sign in as each owner with the temporary password. The app asks for a new one immediately.
4. Remove `SEED_OWNER_PASSWORD` from the environment and redeploy. The seed never resets an existing
   password, but the temporary one shouldn't stay stored anywhere.
5. In the app, check Settings → Integrations shows email and storage as **Connected**. Then raise a test
   proforma, download its PDF and email it to yourself, and upload and download a file in the Vault.
6. Point an uptime monitor (e.g. UptimeRobot or Better Stack) at `/api/health`.

## 8. Continuous deployment

`.github/workflows/ci.yml` runs typecheck, lint, unit tests, a production build and the Playwright suite
(against Postgres, MinIO and Mailpit) on every push. On `main` it then calls the Coolify deploy webhook.

- Coolify app → Webhooks: copy the **Deploy webhook** URL, and create an API token (Keys & Tokens) with deploy permission.
- GitHub → Settings → Secrets → Actions: add `COOLIFY_WEBHOOK` and `COOLIFY_TOKEN`.
- Turn **off** Coolify's own auto-deploy on push, so only commits that passed CI go live.

## 9. Updating and rolling back

- **Update**: merge to `main`. CI deploys; the container migrates the database on start. If a migration
  fails, the container exits before serving, and with the health check set Coolify keeps the previous container.
- **Roll back the app**: Coolify app → Deployments → pick the previous successful deployment → **Redeploy**.
  Migrations only move forward. So far they only add tables and columns, so older code still runs against the
  newer database; check that holds before rolling back past a migration that removes or renames something.
- **Roll back data**: only for a damaged database. Restore last night's backup (runbook → Restore).

## 10. Security checklist

- [ ] SSH keys only; root password login off; ufw on (22, 80, 443).
- [ ] Coolify admin has 2FA; dashboard only at `https://coolify.patmichaels.in`.
- [ ] Postgres and MinIO have no public ports; MinIO console has no domain.
- [ ] App uses `pm_app` (row access only); migrations use `pm_owner`.
- [ ] MinIO app user limited to the one bucket; bucket versioned and private.
- [ ] All secrets only in Coolify and the password manager; `SEED_OWNER_PASSWORD` removed after first sign-in.
- [ ] `AUTH_OTP_FOR_ADMINS=true`.
- [ ] Daily database backup off the VPS, nightly bucket mirror, and a restore tested (runbook).
- [ ] Email SPF/DKIM/DMARC records in place.
