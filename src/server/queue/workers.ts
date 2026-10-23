import "server-only";
import { writeAudit } from "../audit";
import { db } from "../db";
import { sendMail, type MailAttachment } from "../email/mailer";
import { errorText, logger } from "../logger";
import { purgeRateLimits } from "../rate-limit";
import { getBoss, QUEUES, type AttachmentSpec, type EmailJob, type ReminderJob } from "./index";

type AttachmentResolver = (spec: AttachmentSpec) => Promise<MailAttachment>;
type ReminderHandler = (job: ReminderJob) => Promise<void>;

/** Modules register renderers/handlers here so the queue layer has no static dependency on them. */
const attachmentResolvers = new Map<AttachmentSpec["kind"], AttachmentResolver>();
let reminderHandler: ReminderHandler | undefined;

export function registerAttachmentResolver(kind: AttachmentSpec["kind"], resolver: AttachmentResolver) {
  attachmentResolvers.set(kind, resolver);
}
export function registerReminderHandler(handler: ReminderHandler) {
  reminderHandler = handler;
}

async function handleEmail(job: EmailJob) {
  const attachments: MailAttachment[] = [];
  for (const spec of job.attachments ?? []) {
    const resolver = attachmentResolvers.get(spec.kind);
    if (!resolver) throw new Error(`No attachment renderer registered for ${spec.kind}`);
    attachments.push(await resolver(spec));
  }
  await sendMail({ to: job.to, subject: job.subject, html: job.html, text: job.text, replyTo: job.replyTo, attachments });
  if (job.audit) {
    await writeAudit(db, {
      actor: null,
      module: job.audit.module as never,
      action: "email",
      text: `Email “${job.subject}” sent to ${job.to}`,
      entityType: job.audit.entityType,
      entityId: job.audit.entityId,
    });
  }
}

async function maintenance() {
  const purged = await purgeRateLimits(24);
  const tokens = await db.authToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } });
  logger.info({ purged, tokens: tokens.count }, "maintenance done");
}

let started: Promise<void> | undefined;

/**
 * Starts job workers in this process (WORKER_ENABLED=true). Safe to call more than once; a failed
 * start (e.g. the database was still booting) is forgotten so the next call tries again.
 */
export function startWorkers(): Promise<void> {
  started ??= runWorkers().catch((err) => {
    started = undefined;
    throw err;
  });
  return started;
}

async function runWorkers(): Promise<void> {
  // Side-effect imports register PDF attachment renderers and reminder handlers.
  await import("../workers-registry");
  const boss = await getBoss();
  /** pg-boss retries failed jobs; log every failure so it is visible in the container logs. */
  const logged = <T>(queue: string, fn: (data: T) => Promise<void>) => async ([job]: { id: string; data: T; retryCount: number }[]) => {
    if (!job) return;
    try {
      await fn(job.data);
    } catch (err) {
      logger.error({ queue, jobId: job.id, retry: job.retryCount, err: errorText(err) }, "job failed");
      throw err;
    }
  };
  await boss.work<EmailJob>(QUEUES.email, { batchSize: 1 }, logged<EmailJob>(QUEUES.email, handleEmail));
  await boss.work<ReminderJob>(QUEUES.reminder, { batchSize: 1 }, logged<ReminderJob>(QUEUES.reminder, async (data) => reminderHandler?.(data)));
  await boss.work(QUEUES.maintenance, async () => maintenance());
  await boss.schedule(QUEUES.maintenance, "0 3 * * *", {}, { tz: "Asia/Kolkata" });
  logger.info("job workers started");
}
