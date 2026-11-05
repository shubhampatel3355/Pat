# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Pat Michaels OS — production image (Next.js standalone + Chromium for PDFs)
#   docker build -t pat-michaels-os --build-arg APP_VERSION=$(git rev-parse --short HEAD) .
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_IMAGE=node:22-bookworm-slim

# ── Base: Node + pnpm ────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app

# ── Dependencies (cached on lockfile) ────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── Build ────────────────────────────────────────────────────────────────────
FROM base AS build
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate \
 && pnpm exec next build \
 && pnpm exec esbuild prisma/seed.ts --bundle --platform=node --format=esm --target=node22 \
      --outfile=dist/seed.mjs --log-level=warning \
      --external:@node-rs/argon2 --external:pg-native \
      --banner:js="import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);"

# ── Prisma CLI for `migrate deploy` at start-up (kept apart from the app's node_modules) ──
FROM base AS migrator
WORKDIR /migrator
RUN npm init -y >/dev/null \
 && npm install --omit=dev --no-audit --no-fund --loglevel=error prisma@7.10.1 dotenv@17.4.2

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    APP_VERSION=${APP_VERSION} \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Asia/Kolkata \
    CHROMIUM_PATH=/usr/bin/chromium

# Chromium renders invoice / payslip PDFs from the app's own /print pages.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-noto-core tzdata ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 app \
 && useradd --system --uid 1001 --gid app --create-home --home-dir /home/app app

WORKDIR /app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma/schema.prisma ./db/prisma/schema.prisma
COPY --from=build --chown=app:app /app/prisma/migrations ./db/prisma/migrations
COPY --from=build --chown=app:app /app/prisma7.config.ts ./db/prisma7.config.ts
COPY --from=build --chown=app:app /app/dist/seed.mjs ./db/seed.mjs
COPY --from=migrator --chown=app:app /migrator/node_modules ./db/node_modules
COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
