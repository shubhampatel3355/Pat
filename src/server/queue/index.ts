import "server-only";
import { fromPrisma, PgBoss } from "pg-boss";
import type { Tx } from "../db";
import { env } from "../env";
import { logger } from "../logger";

export const QUEUES = {
  email: "email-send",
  reminder: "reminder-fire",
  maintenance: "maintenance",
} as const;

export type AttachmentSpec =
  | { kind: "invoice-pdf"; invoiceId: string }
  | { kind: "payslip-pdf"; userId: string; periodType: "MONTHLY" | "QUARTERLY" | "YEARLY"; period: string };

export interface EmailJob {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: AttachmentSpec[];
  /** Audit context for "email sent" entries. */
  audit?: { module: string; entityType?: string; entityId?: string };
}

export interface ReminderJob {
  kind: "todo" | "task" | "followup";
  id: string;
  /** The due instant this job was scheduled for (ISO); stale jobs are ignored. */
  at?: string;
}

interface Payloads {
  [QUEUES.email]: EmailJob;
  [QUEUES.reminder]: ReminderJob;
  [QUEUES.maintenance]: Record<string, never>;
}

let starting: Promise<PgBoss> | undefined;

/** Lazily started pg-boss instance (schema `pgboss`, created/migrated by pg-boss itself). */
export function getBoss(): Promise<PgBoss> {
  starting ??= (async () => {
    const e = env();
    const boss = new PgBoss({
      connectionString: e.DATABASE_URL,
      schema: "pgboss",
      max: 4,
      application_name: "pm-os-queue",
      supervise: e.WORKER_ENABLED,
      schedule: e.WORKER_ENABLED,
    });
    boss.on("error", (err) => logger.error({ err: err instanceof Error ? err.message : err }, "pg-boss error"));
    await boss.start();
    const queues: [string, Parameters<PgBoss["createQueue"]>[1]][] = [
      [QUEUES.email, { retryLimit: 6, retryDelay: 30, retryBackoff: true, expireInSeconds: 300 }],
      [QUEUES.reminder, { retryLimit: 3, retryDelay: 60, expireInSeconds: 120 }],
      [QUEUES.maintenance, { retryLimit: 1, expireInSeconds: 600 }],
    ];
    for (const [name, options] of queues) {
      if (!(await boss.getQueue(name))) await boss.createQueue(name, options);
    }
    return boss;
  })().catch((err) => {
    starting = undefined;
    throw err;
  });
  return starting;
}

/**
 * Enqueue a job. Pass `tx` to insert it inside the caller's Prisma transaction, so the job exists
 * if and only if the business change committed (transactional outbox).
 */
export async function enqueue<Q extends keyof Payloads>(
  queue: Q,
  data: Payloads[Q],
  opts: { tx?: Tx; startAfter?: Date; singletonKey?: string } = {},
): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(queue, data as object, {
    startAfter: opts.startAfter,
    singletonKey: opts.singletonKey,
    ...(opts.tx ? { db: fromPrisma(opts.tx as unknown as Parameters<typeof fromPrisma>[0]) } : {}),
  });
}

export async function stopBoss(): Promise<void> {
  if (!starting) return;
  const boss = await starting.catch(() => undefined);
  await boss?.stop({ graceful: true, timeout: 10_000 });
  starting = undefined;
}
