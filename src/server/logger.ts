import "server-only";
import pino from "pino";

/**
 * Structured JSON logs (one line per event) for Coolify / docker logs.
 * Locally, pipe through `pnpm exec pino-pretty` for readable output.
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
