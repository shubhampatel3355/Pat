import "server-only";
import { logger } from "./logger";

/** Optional error tracking: the SDK is loaded only when SENTRY_DSN is set. Errors are always logged as JSON too. */
let sentry: typeof import("@sentry/node") | undefined;

export async function initSentry(dsn: string, environment: string) {
  sentry = await import("@sentry/node");
  sentry.init({ dsn, environment, tracesSampleRate: 0 });
  logger.info("Sentry enabled");
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  sentry?.captureException(error, { extra: context });
}
