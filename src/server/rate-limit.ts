import "server-only";
import { db } from "./db";

interface RateLimitResult {
  ok: boolean;
  count: number;
  retryAfterSec: number;
}

/**
 * Fixed-window counter in Postgres (works across instances, survives restarts, no Redis).
 * One atomic upsert per call. Old windows are purged by the daily maintenance job.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const windowMs = windowSec * 1000;
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count`;
  const count = Number(rows[0]?.count ?? 1);
  const retryAfterSec = Math.ceil((windowStart.getTime() + windowMs - now) / 1000);
  return { ok: count <= limit, count, retryAfterSec };
}

export async function purgeRateLimits(olderThanHours = 24): Promise<number> {
  return db.$executeRaw`DELETE FROM rate_limits WHERE window_start < now() - make_interval(hours => ${olderThanHours})`;
}

export const LIMITS = {
  loginPerIp: { limit: 30, windowSec: 15 * 60 },
  loginPerEmail: { limit: 8, windowSec: 15 * 60 },
  passwordResetPerEmail: { limit: 3, windowSec: 60 * 60 },
  uploadPerUser: { limit: 60, windowSec: 10 * 60 },
  pdfPerUser: { limit: 40, windowSec: 5 * 60 },
  exportPerUser: { limit: 20, windowSec: 10 * 60 },
} as const;
