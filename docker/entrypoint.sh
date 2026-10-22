#!/bin/sh
# Container start-up: apply migrations, run the idempotent seed, then start the server.
set -eu

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] applying database migrations"
  # MIGRATION_DATABASE_URL (schema owner) is used when set; otherwise DATABASE_URL.
  (cd /app/db && node node_modules/prisma/build/index.js migrate deploy)
fi

if [ "${RUN_SEED_ON_START:-true}" = "true" ]; then
  echo "[entrypoint] running idempotent seed"
  node /app/db/seed.mjs
fi

echo "[entrypoint] starting Pat Michaels OS ${APP_VERSION:-dev}"
exec "$@"
