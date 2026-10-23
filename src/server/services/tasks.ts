import "server-only";
import type { FollowUpType, TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import { CLOSED_REMARKS } from "@/lib/constants";
import { initialsOf } from "../auth/session";
import { db } from "../db";
import { can, type SessionUser } from "../policy";
import { followUpScope, taskScope, wipScope } from "../policy/scopes";

interface Person {
  id: string;
  name: string;
  initials: string;
}

const person = (u: { id: string; name: string }): Person => ({ id: u.id, name: u.name, initials: initialsOf(u.name) });

export interface TaskCommentDto {
  id: string;
  author: Person;
  body: string;
  at: string;
}

export interface TaskDto {
  id: string;
  title: string;
  assignee: Person;
  createdBy: string;
  dueAt: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  lead: { id: string; name: string } | null;
  reminders: { inApp: boolean; email: boolean; whatsapp: boolean };
  comments: TaskCommentDto[];
  canEdit: boolean;
  canDelete: boolean;
}

export interface FollowUpDto {
  id: string;
  contactName: string;
  type: FollowUpType;
  note: string;
  owner: Person;
  dueAt: string;
  lead: { id: string; name: string } | null;
  canEdit: boolean;
}

export interface LeadOption {
  id: string;
  name: string;
}

/** Open tasks plus anything finished in the last two weeks (the Done column). */
export async function listTasks(user: SessionUser): Promise<TaskDto[]> {
  const rows = await db.task.findMany({
    where: { AND: [taskScope(user), { OR: [{ status: { not: "DONE" } }, { completedAt: { gte: new Date(Date.now() - 14 * 86_400_000) } }] }] },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 400,
    include: {
      assignee: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      lead: { select: { id: true, tenantName: true, deletedAt: true } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true } } } },
    },
  });
  return rows.map((t) => {
    const record = { type: "task" as const, assigneeId: t.assigneeId, createdById: t.createdById };
    return {
      id: t.id,
      title: t.title,
      assignee: person(t.assignee),
      createdBy: t.createdBy.name,
      dueAt: t.dueAt?.toISOString() ?? null,
      priority: t.priority,
      status: t.status,
      lead: t.lead && !t.lead.deletedAt ? { id: t.lead.id, name: t.lead.tenantName } : null,
      reminders: { inApp: t.remindInApp, email: t.remindEmail, whatsapp: t.remindWhatsapp },
      comments: t.comments.map((c) => ({ id: c.id, author: person(c.author), body: c.body, at: c.createdAt.toISOString() })),
      canEdit: can(user, "update", record),
      canDelete: can(user, "delete", record),
    };
  });
}

/** Follow-ups still to do, soonest first. */
export async function listFollowUps(user: SessionUser): Promise<FollowUpDto[]> {
  const rows = await db.followUp.findMany({
    where: { AND: [followUpScope(user), { completedAt: null }] },
    orderBy: { dueAt: "asc" },
    take: 400,
    include: { owner: { select: { id: true, name: true } }, lead: { select: { id: true, tenantName: true, deletedAt: true } } },
  });
  return rows.map((f) => ({
    id: f.id,
    contactName: f.contactName,
    type: f.type,
    note: f.note ?? "",
    owner: person(f.owner),
    dueAt: f.dueAt.toISOString(),
    lead: f.lead && !f.lead.deletedAt ? { id: f.lead.id, name: f.lead.tenantName } : null,
    canEdit: can(user, "update", { type: "followup", ownerId: f.ownerId, createdById: f.createdById }),
  }));
}

/** Open WIP rows the user can see, for linking tasks and follow-ups. */
export async function linkableLeads(user: SessionUser): Promise<LeadOption[]> {
  const rows = await db.lead.findMany({
    where: { AND: [wipScope(user), { remark: { notIn: CLOSED_REMARKS } }] },
    orderBy: { tenantName: "asc" },
    select: { id: true, tenantName: true },
  });
  return rows.map((l) => ({ id: l.id, name: l.tenantName }));
}
