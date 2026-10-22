import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { has, isAdminOrOwner, type SessionUser } from "./index";

/**
 * Prisma `where` filters that mirror `can(user, "view", …)` for lists. Keep these and the
 * single-record rules in ./index.ts in sync (covered by tests/unit/policy.test.ts).
 */

export function wipScope(u: SessionUser): Prisma.LeadWhereInput {
  const base: Prisma.LeadWhereInput = { deletedAt: null };
  if (has(u, "wip.view_all")) return base;
  return { ...base, brokers: { some: { userId: u.id } } };
}

export function bdScope(u: SessionUser): Prisma.BdMeetingWhereInput {
  const base: Prisma.BdMeetingWhereInput = { deletedAt: null };
  if (has(u, "bd.view_all")) return base;
  return { ...base, OR: [{ primaryBrokerId: u.id }, { secondaryBrokerId: u.id }, { createdById: u.id }] };
}

export function taskScope(u: SessionUser): Prisma.TaskWhereInput {
  const base: Prisma.TaskWhereInput = { deletedAt: null };
  if (has(u, "tasks.view_all")) return base;
  return { ...base, OR: [{ assigneeId: u.id }, { createdById: u.id }] };
}

export function followUpScope(u: SessionUser): Prisma.FollowUpWhereInput {
  const base: Prisma.FollowUpWhereInput = { deletedAt: null };
  if (has(u, "tasks.view_all")) return base;
  return { ...base, OR: [{ ownerId: u.id }, { createdById: u.id }] };
}

export function payslipScope(u: SessionUser): Prisma.PayslipWhereInput {
  return has(u, "payroll.view_all") ? {} : { userId: u.id };
}

/** Audit rows the user may see in the activity ticker. */
export function feedScope(u: SessionUser): Prisma.AuditLogWhereInput {
  if (isAdminOrOwner(u)) return { feed: true };
  return { feed: true, OR: [{ visibility: "PUBLIC" }, { actorId: u.id }, { subjectUserIds: { has: u.id } }] };
}
