"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { ok } from "@/lib/action-result";
import { FOLLOW_UP_TYPES, TASK_STATUS } from "@/lib/constants";
import { isoDateIST, istToInstant } from "@/lib/dates";
import { followUpInputSchema, followUpRescheduleSchema, followUpUpdateSchema, taskCommentSchema, taskInputSchema, taskRemindersSchema, taskStatusSchema, taskUpdateSchema } from "@/lib/schemas/tasks";
import { DEFAULT_TASK_TIME, instantLabel } from "@/lib/tasks";
import { writeAudit } from "../audit";
import { db } from "../db";
import { assertCan, can, type SessionUser } from "../policy";
import { wipScope } from "../policy/scopes";
import { notify } from "../services/notify";
import { scheduleFollowUpReminder, scheduleTaskReminder } from "../services/reminders";
import { defineAction, UserError } from "./define";

const idSchema = z.object({ id: z.uuid() });
const typeLabel = (v: string) => FOLLOW_UP_TYPES.find((t) => t.value === v)?.label ?? v;

async function activeUser(id: string, what: string) {
  const u = await db.user.findFirst({ where: { id, active: true, deletedAt: null }, select: { id: true, name: true } });
  if (!u) throw new UserError(`Pick an active ${what}`);
  return u;
}

async function assertLeadVisible(user: SessionUser, leadId: string | null) {
  if (!leadId) return;
  const lead = await db.lead.findFirst({ where: { AND: [wipScope(user), { id: leadId }] }, select: { id: true } });
  if (!lead) throw new UserError("That WIP row is not available");
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

const taskDueAt = (date: string | null, time: string | null) => (date ? istToInstant(date, time ?? DEFAULT_TASK_TIME) : null);

/** The columns a task's form sets: the same for a new task and an edit. */
function taskColumns(input: z.output<typeof taskInputSchema>, assigneeId: string) {
  return {
    title: input.title,
    assigneeId,
    dueAt: taskDueAt(input.dueDate, input.dueTime),
    priority: input.priority,
    leadId: input.leadId,
    remindInApp: input.remindInApp,
    remindEmail: input.remindEmail,
    remindWhatsapp: input.remindWhatsapp,
  };
}

export const createTaskAction = defineAction({
  schema: taskInputSchema,
  authorize: (user) => can(user, "create", { type: "task" }),
  handler: async ({ user, input, meta }) => {
    const assignee = await activeUser(input.assigneeId, "assignee");
    await assertLeadVisible(user, input.leadId);
    const task = await db.$transaction(async (tx) => {
      const created = await tx.task.create({ data: { ...taskColumns(input, assignee.id), createdById: user.id } });
      await scheduleTaskReminder(tx, created);
      await writeAudit(tx, {
        actor: user,
        module: "Tasks",
        action: "create",
        text: `${user.name} created the task “${input.title}”${assignee.id === user.id ? "" : ` for ${assignee.name}`}`,
        entityType: "Task",
        entityId: created.id,
        after: input,
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: [assignee.id, user.id],
      });
      await notify(tx, [assignee.id], { kind: "task", text: `${user.name} assigned you “${input.title}”`, href: `/follow-ups?task=${created.id}` }, user.id);
      return created;
    });
    refresh();
    return ok(assignee.id === user.id ? "Task added" : `Task assigned to ${assignee.name}`, { id: task.id });
  },
});

async function loadTask(user: SessionUser, id: string) {
  const task = await db.task.findFirst({ where: { id, deletedAt: null } });
  if (!task) throw new UserError("That task no longer exists");
  assertCan(user, "update", { type: "task", assigneeId: task.assigneeId, createdById: task.createdById });
  return task;
}

export const updateTaskAction = defineAction({
  schema: taskUpdateSchema,
  authorize: (user) => can(user, "create", { type: "task" }),
  handler: async ({ user, input, meta }) => {
    const before = await loadTask(user, input.id);
    const assignee = input.assigneeId === before.assigneeId ? { id: before.assigneeId, name: "" } : await activeUser(input.assigneeId, "assignee");
    if (input.leadId !== before.leadId) await assertLeadVisible(user, input.leadId);
    await db.$transaction(async (tx) => {
      const updated = await tx.task.update({ where: { id: before.id }, data: taskColumns(input, assignee.id) });
      await scheduleTaskReminder(tx, updated);
      await writeAudit(tx, {
        actor: user,
        module: "Tasks",
        action: "update",
        text: `${user.name} updated the task “${input.title}”`,
        entityType: "Task",
        entityId: before.id,
        before,
        after: input,
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: [...new Set([before.assigneeId, assignee.id, before.createdById])],
      });
      if (assignee.id !== before.assigneeId) await notify(tx, [assignee.id], { kind: "task", text: `${user.name} assigned you “${input.title}”`, href: `/follow-ups?task=${before.id}` }, user.id);
    });
    refresh();
    return ok("Task updated");
  },
});

export const setTaskStatusAction = defineAction({
  schema: taskStatusSchema,
  authorize: (user) => can(user, "create", { type: "task" }),
  handler: async ({ user, input, meta }) => {
    const before = await loadTask(user, input.id);
    if (before.status === input.status) return ok();
    const done = input.status === "DONE";
    await db.$transaction(async (tx) => {
      const updated = await tx.task.update({ where: { id: before.id }, data: { status: input.status, completedAt: done ? new Date() : null } });
      if (!done) await scheduleTaskReminder(tx, updated);
      await writeAudit(tx, {
        actor: user,
        module: "Tasks",
        action: "update",
        text: done ? `${user.name} completed “${before.title}”` : `${user.name} moved “${before.title}” to ${TASK_STATUS[input.status].label}`,
        entityType: "Task",
        entityId: before.id,
        before: { status: before.status },
        after: { status: input.status },
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: [before.assigneeId, before.createdById],
        feed: done,
      });
      if (done) await notify(tx, [before.createdById, before.assigneeId], { kind: "task", text: `${user.name} completed “${before.title}”`, href: `/follow-ups?task=${before.id}` }, user.id);
    });
    refresh();
    return ok(done ? "Task completed" : `Moved to ${TASK_STATUS[input.status].label}`);
  },
});

export const setTaskRemindersAction = defineAction({
  schema: taskRemindersSchema,
  authorize: (user) => can(user, "create", { type: "task" }),
  handler: async ({ user, input, meta }) => {
    const before = await loadTask(user, input.id);
    await db.$transaction(async (tx) => {
      const updated = await tx.task.update({ where: { id: before.id }, data: { remindInApp: input.remindInApp, remindEmail: input.remindEmail, remindWhatsapp: input.remindWhatsapp } });
      await scheduleTaskReminder(tx, updated);
      await writeAudit(tx, {
        actor: user,
        module: "Tasks",
        action: "update",
        text: `${user.name} changed reminders on “${before.title}”`,
        entityType: "Task",
        entityId: before.id,
        before: { remindInApp: before.remindInApp, remindEmail: before.remindEmail, remindWhatsapp: before.remindWhatsapp },
        after: input,
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: [before.assigneeId, before.createdById],
      });
    });
    refresh();
    return ok("Reminders updated");
  },
});

export const addTaskCommentAction = defineAction({
  schema: taskCommentSchema,
  authorize: (user) => can(user, "create", { type: "task" }),
  handler: async ({ user, input, meta }) => {
    const task = await loadTask(user, input.taskId);
    await db.$transaction(async (tx) => {
      const comment = await tx.taskComment.create({ data: { taskId: task.id, authorId: user.id, body: input.body } });
      await writeAudit(tx, {
        actor: user,
        module: "Tasks",
        action: "create",
        text: `${user.name} commented on “${task.title}”`,
        entityType: "TaskComment",
        entityId: comment.id,
        after: { taskId: task.id, body: input.body },
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: [task.assigneeId, task.createdById],
      });
      await notify(tx, [task.assigneeId, task.createdById], { kind: "task", text: `${user.name} commented on “${task.title}”: ${input.body}`, href: `/follow-ups?task=${task.id}` }, user.id);
    });
    refresh();
    return ok("Comment posted");
  },
});

export const deleteTaskAction = defineAction({
  schema: idSchema,
  authorize: (user) => can(user, "create", { type: "task" }),
  handler: async ({ user, input, meta }) => {
    const task = await db.task.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!task) throw new UserError("That task no longer exists");
    assertCan(user, "delete", { type: "task", assigneeId: task.assigneeId, createdById: task.createdById });
    await db.$transaction(async (tx) => {
      await tx.task.update({ where: { id: task.id }, data: { deletedAt: new Date() } });
      await writeAudit(tx, {
        actor: user,
        module: "Tasks",
        action: "delete",
        text: `${user.name} deleted the task “${task.title}”`,
        entityType: "Task",
        entityId: task.id,
        before: task,
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: [task.assigneeId, task.createdById],
      });
    });
    refresh();
    return ok("Task deleted");
  },
});

// ── Follow-ups ────────────────────────────────────────────────────────────────

export const createFollowUpAction = defineAction({
  schema: followUpInputSchema,
  authorize: (user) => can(user, "create", { type: "followup" }),
  handler: async ({ user, input, meta }) => {
    const owner = await activeUser(input.ownerId, "owner");
    await assertLeadVisible(user, input.leadId);
    const dueAt = istToInstant(input.dueDate, input.dueTime);
    const followUp = await db.$transaction(async (tx) => {
      const created = await tx.followUp.create({
        data: { contactName: input.contactName, type: input.type, note: input.note || null, leadId: input.leadId, ownerId: owner.id, createdById: user.id, dueAt },
      });
      await scheduleFollowUpReminder(tx, created);
      await writeAudit(tx, {
        actor: user,
        module: "Tasks",
        action: "create",
        text: `${user.name} scheduled a ${typeLabel(input.type).toLowerCase()} follow-up with ${input.contactName}`,
        entityType: "FollowUp",
        entityId: created.id,
        after: input,
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: [owner.id, user.id],
      });
      await notify(tx, [owner.id], { kind: "followup", text: `${user.name} gave you a follow-up with ${input.contactName} · ${instantLabel(dueAt.toISOString(), isoDateIST())}`, href: `/follow-ups?followup=${created.id}` }, user.id);
      return created;
    });
    refresh();
    return ok(`Follow-up with ${input.contactName} scheduled`, { id: followUp.id });
  },
});

async function loadFollowUp(user: SessionUser, id: string) {
  const f = await db.followUp.findFirst({ where: { id, deletedAt: null } });
  if (!f) throw new UserError("That follow-up no longer exists");
  assertCan(user, "update", { type: "followup", ownerId: f.ownerId, createdById: f.createdById });
  return f;
}

export const updateFollowUpAction = defineAction({
  schema: followUpUpdateSchema,
  authorize: (user) => can(user, "create", { type: "followup" }),
  handler: async ({ user, input, meta }) => {
    const before = await loadFollowUp(user, input.id);
    const owner = input.ownerId === before.ownerId ? { id: before.ownerId } : await activeUser(input.ownerId, "owner");
    if (input.leadId !== before.leadId) await assertLeadVisible(user, input.leadId);
    await db.$transaction(async (tx) => {
      const updated = await tx.followUp.update({
        where: { id: before.id },
        data: { contactName: input.contactName, type: input.type, note: input.note || null, leadId: input.leadId, ownerId: owner.id, dueAt: istToInstant(input.dueDate, input.dueTime) },
      });
      await scheduleFollowUpReminder(tx, updated);
      await writeAudit(tx, {
        actor: user,
        module: "Tasks",
        action: "update",
        text: `${user.name} updated the follow-up with ${input.contactName}`,
        entityType: "FollowUp",
        entityId: before.id,
        before,
        after: input,
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: [...new Set([before.ownerId, owner.id])],
      });
      if (owner.id !== before.ownerId) await notify(tx, [owner.id], { kind: "followup", text: `${user.name} gave you a follow-up with ${input.contactName}`, href: `/follow-ups?followup=${before.id}` }, user.id);
    });
    refresh();
    return ok("Follow-up updated");
  },
});

export const rescheduleFollowUpAction = defineAction({
  schema: followUpRescheduleSchema,
  authorize: (user) => can(user, "create", { type: "followup" }),
  handler: async ({ user, input, meta }) => {
    const before = await loadFollowUp(user, input.id);
    const dueAt = istToInstant(input.dueDate, input.dueTime);
    const label = instantLabel(dueAt.toISOString(), isoDateIST());
    await db.$transaction(async (tx) => {
      const updated = await tx.followUp.update({ where: { id: before.id }, data: { dueAt } });
      await scheduleFollowUpReminder(tx, updated);
      await writeAudit(tx, {
        actor: user,
        module: "Tasks",
        action: "update",
        text: `${user.name} moved the follow-up with ${before.contactName} to ${label}`,
        entityType: "FollowUp",
        entityId: before.id,
        before: { dueAt: before.dueAt },
        after: { dueAt },
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: [before.ownerId],
      });
    });
    refresh();
    return ok(`Moved to ${label}`);
  },
});

export const completeFollowUpAction = defineAction({
  schema: idSchema,
  authorize: (user) => can(user, "create", { type: "followup" }),
  handler: async ({ user, input, meta }) => {
    const before = await loadFollowUp(user, input.id);
    if (before.completedAt) return ok();
    await db.$transaction(async (tx) => {
      await tx.followUp.update({ where: { id: before.id }, data: { completedAt: new Date() } });
      await writeAudit(tx, {
        actor: user,
        module: "Tasks",
        action: "update",
        text: `${user.name} completed a ${typeLabel(before.type).toLowerCase()} follow-up with ${before.contactName}`,
        entityType: "FollowUp",
        entityId: before.id,
        after: { completed: true },
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: [before.ownerId, before.createdById],
        feed: true,
      });
    });
    refresh();
    return ok(`Follow-up with ${before.contactName} completed`);
  },
});

export const deleteFollowUpAction = defineAction({
  schema: idSchema,
  authorize: (user) => can(user, "create", { type: "followup" }),
  handler: async ({ user, input, meta }) => {
    const before = await loadFollowUp(user, input.id);
    await db.$transaction(async (tx) => {
      await tx.followUp.update({ where: { id: before.id }, data: { deletedAt: new Date() } });
      await writeAudit(tx, {
        actor: user,
        module: "Tasks",
        action: "delete",
        text: `${user.name} deleted the follow-up with ${before.contactName}`,
        entityType: "FollowUp",
        entityId: before.id,
        before,
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: [before.ownerId, before.createdById],
      });
    });
    refresh();
    return ok("Follow-up deleted");
  },
});
