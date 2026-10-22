import "server-only";
import { writeAudit } from "../audit";
import { db } from "../db";
import { sendMail, type MailAttachment } from "../email/mailer";
import { logger } from "../logger";
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

let started = false;

/** Starts job workers in this process (WORKER_ENABLED=true). Safe to call more than once. */
export async function startWorkers(): Promise<void> {
  if (started) return;
  started = true;
  // Side-effect imports register PDF attachment renderers and reminder handlers.
  await import("../workers-registry");
  const boss = await getBoss();
  await boss.work<EmailJob>(QUEUES.email, { batchSize: 1 }, async ([job]) => {
    if (job) await handleEmail(job.data);
  });
  await boss.work<ReminderJob>(QUEUES.reminder, { batchSize: 1 }, async ([job]) => {
    if (job && reminderHandler) await reminderHandler(job.data);
  });
  await boss.work(QUEUES.maintenance, async () => maintenance());
  await boss.schedule(QUEUES.maintenance, "0 3 * * *", {}, { tz: "Asia/Kolkata" });
  logger.info("job workers started");
}
