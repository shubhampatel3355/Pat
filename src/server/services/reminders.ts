import "server-only";
import { dateToIso, formatDateTimeShort, istToInstant } from "@/lib/dates";
import { db, type Tx } from "../db";
import { reminderEmail } from "../email/templates";
import { env } from "../env";
import { logger } from "../logger";
import { enqueue, QUEUES, type ReminderJob } from "../queue";

/**
 * Reminders are delayed jobs. Each job carries the instant it was scheduled for; when it fires the
 * handler re-reads the record and only notifies if it is still due at that instant and not done —
 * so rescheduling or completing a to-do silently cancels older jobs.
 */

export function todoDueInstant(todo: { dueDate: Date | null; dueTime: string | null }): Date | null {
  if (!todo.dueDate) return null;
  return istToInstant(dateToIso(todo.dueDate), todo.dueTime ?? "09:00");
}

export async function scheduleTodoReminder(tx: Tx, todo: { id: string; dueDate: Date | null; dueTime: string | null; remind: boolean; done: boolean }) {
  const at = todoDueInstant(todo);
  if (!todo.remind || todo.done || !at || at.getTime() < Date.now() - 60_000) return;
  await enqueue(QUEUES.reminder, { kind: "todo", id: todo.id, at: at.toISOString() }, { tx, startAfter: at, singletonKey: `todo:${todo.id}:${at.toISOString()}` });
}

export async function scheduleTaskReminder(tx: Tx, task: { id: string; dueAt: Date | null; status: string; remindInApp: boolean; remindEmail: boolean }) {
  if (!task.dueAt || task.status === "DONE" || (!task.remindInApp && !task.remindEmail)) return;
  if (task.dueAt.getTime() < Date.now() - 60_000) return;
  await enqueue(QUEUES.reminder, { kind: "task", id: task.id, at: task.dueAt.toISOString() }, { tx, startAfter: task.dueAt, singletonKey: `task:${task.id}:${task.dueAt.toISOString()}` });
}

export async function handleReminder(job: ReminderJob) {
  const appUrl = env().APP_URL.replace(/\/$/, "");
  if (job.kind === "todo") {
    const todo = await db.todo.findUnique({ where: { id: job.id }, include: { user: true } });
    if (!todo || todo.done || !todo.remind) return;
    const due = todoDueInstant(todo);
    if (!due || (job.at && due.toISOString() !== job.at)) return; // rescheduled since
    await db.notification.create({ data: { userId: todo.userId, kind: "reminder", text: `Reminder: ${todo.text}`, href: "/dashboard" } });
    return;
  }
  const task = await db.task.findUnique({ where: { id: job.id }, include: { assignee: true } });
  if (!task || task.deletedAt || task.status === "DONE" || !task.dueAt) return;
  if (job.at && task.dueAt.toISOString() !== job.at) return;
  if (task.remindInApp) {
    await db.notification.create({ data: { userId: task.assigneeId, kind: "reminder", text: `Task due: ${task.title}`, href: `/follow-ups?task=${task.id}` } });
  }
  if (task.remindEmail) {
    const mail = reminderEmail({ name: task.assignee.name, what: task.title, when: formatDateTimeShort(task.dueAt), link: `${appUrl}/follow-ups?task=${task.id}` });
    await enqueue(QUEUES.email, { to: task.assignee.email, subject: mail.subject, html: mail.html, text: mail.text });
  }
  if (task.remindWhatsapp) logger.info({ taskId: task.id }, "WhatsApp reminder requested but the WhatsApp integration is not enabled");
}
