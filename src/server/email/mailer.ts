import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env";
import { logger } from "../logger";

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: MailAttachment[];
}

let transport: Transporter | undefined;

function smtp(): Transporter {
  if (transport) return transport;
  const e = env();
  transport = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
    pool: true,
    maxConnections: 2,
  });
  return transport;
}

/** Sends immediately. Prefer `enqueue(QUEUES.email, …)` so sends are retried and survive restarts. */
export async function sendMail(message: MailMessage): Promise<void> {
  const e = env();
  if (e.MAIL_DRIVER === "file") {
    // Development only (rejected in production by env validation): write the message to .local/mail.
    const dir = path.resolve(".local/mail");
    await mkdir(dir, { recursive: true });
    const base = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${message.to.replace(/[^a-z0-9@.-]/gi, "_")}`);
    await writeFile(`${base}.html`, message.html);
    await writeFile(`${base}.json`, JSON.stringify({ ...message, html: undefined, attachments: message.attachments?.map((a) => a.filename) }, null, 2));
    for (const a of message.attachments ?? []) await writeFile(`${base}-${a.filename}`, a.content);
    logger.info({ to: message.to, subject: message.subject, file: `${base}.html` }, "email written to file (MAIL_DRIVER=file)");
    return;
  }
  await smtp().sendMail({
    from: e.MAIL_FROM,
    to: message.to,
    replyTo: message.replyTo,
    subject: message.subject,
    html: message.html,
    text: message.text,
    attachments: message.attachments,
  });
  logger.info({ to: message.to, subject: message.subject }, "email sent");
}
