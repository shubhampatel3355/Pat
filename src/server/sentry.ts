import "server-only";
import * as Sentry from "@sentry/node";
import { logger } from "./logger";

/** Optional error tracking: active only when SENTRY_DSN is set. Errors are always logged as JSON too. */
let enabled = false;

export async function initSentry(dsn: string, environment: string) {
  Sentry.init({ dsn, environment, tracesSampleRate: 0 });
  enabled = true;
  logger.info("Sentry enabled");
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (enabled) Sentry.captureException(error, { extra: context });
}
