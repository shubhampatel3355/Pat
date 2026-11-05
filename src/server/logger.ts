import "server-only";
import pino from "pino";

/**
 * Structured JSON logs (one line per event) for Coolify / docker logs.
 * Locally, pipe through `pnpm dlx pino-pretty` for readable output.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "pat-michaels-os" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "password",
      "*.password",
      "passwordHash",
      "*.passwordHash",
      "token",
      "*.token",
      "headers.cookie",
      "*.headers.cookie",
      "headers.authorization",
    ],
    censor: "[redacted]",
  },
});

/** A readable one-line description of any thrown value (connection errors are AggregateErrors with no message). */
export function errorText(err: unknown): string {
  if (err instanceof AggregateError && err.errors.length) return err.errors.map(errorText).join("; ");
  if (err instanceof Error) {
    const code = (err as Error & { code?: string }).code;
    return [err.message || err.name, code].filter(Boolean).join(" · ");
  }
  return String(err);
}
