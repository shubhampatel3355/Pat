import type { Instrumentation } from "next";
import { env } from "./server/env";
import { errorText, logger } from "./server/logger";
import { captureError, initSentry } from "./server/sentry";

/** Validate configuration (fail fast), enable error tracking and start background workers. */
export async function registerNode() {
  const config = env(); // throws with a readable list when configuration is incomplete
  logger.info({ env: config.NODE_ENV, storage: config.STORAGE_DRIVER, mail: config.MAIL_DRIVER, version: process.env.APP_VERSION ?? "dev" }, "Pat Michaels OS starting");

  if (config.SENTRY_DSN) await initSentry(config.SENTRY_DSN, config.NODE_ENV);

  if (config.WORKER_ENABLED) {
    const { startWorkers } = await import("./server/queue/workers");
    const start = async (attempt = 1): Promise<void> => {
      try {
        await startWorkers();
      } catch (err) {
        logger.error({ err: errorText(err), attempt }, "could not start job workers; retrying in 30 s");
        setTimeout(() => void start(attempt + 1), 30_000);
      }
    };
    await start();
  }

  const shutdown = async () => {
    const { stopBoss } = await import("./server/queue");
    await stopBoss();
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}

export function reportRequestError(...[error, request, context]: Parameters<Instrumentation.onRequestError>) {
  const err = error as Error & { digest?: string };
  logger.error(
    { err: { message: err?.message, stack: err?.stack, digest: err?.digest }, path: request.path, method: request.method, route: context.routePath, kind: context.routeType },
    "request error",
  );
  captureError(error, { path: request.path, route: context.routePath });
}
