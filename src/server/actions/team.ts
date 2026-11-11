"use server";

import { refresh } from "./refresh";
import { z } from "zod";
import { ok } from "@/lib/action-result";
import { isoToDate } from "@/lib/dates";
import { memberInputSchema } from "@/lib/schemas/team";
import { writeAudit } from "../audit";
import { INVITE_TTL_HOURS, issueAuthToken } from "../auth/tokens";
import { db, type Tx } from "../db";
import { inviteEmail } from "../email/templates";
import { env } from "../env";
import { enqueue, QUEUES } from "../queue";
import { assertCan, can, has, isOwner, type SessionUser } from "../policy";
import { defineAction, UserError } from "./define";

async function sendInvite(tx: Tx, inviter: SessionUser, member: { id: string; name: string; email: string }) {
  const raw = await issueAuthToken(tx, member.id, "INVITE", INVITE_TTL_HOURS * 3_600_000);
  const link = `${env().APP_URL.replace(/\/$/, "")}/set-password?token=${encodeURIComponent(raw)}`;
  const mail = inviteEmail({ name: member.name, inviterName: inviter.name, link, expiresHours: INVITE_TTL_HOURS });
  await enqueue(
    QUEUES.email,
    { to: member.email, subject: mail.subject, html: mail.html, text: mail.text, audit: { module: "Teams", entityType: "User", entityId: member.id } },
    { tx },
  );
}

async function assertPartner(partnerId: string | null) {
  if (!partnerId) return;
  const partner = await db.user.findFirst({ where: { id: partnerId, role: "OWNER", active: true, deletedAt: null } });
  if (!partner) throw new UserError("Choose one of the partners", { partnerId: "Unknown partner" });
}

async function assertEmailFree(email: string, exceptId?: string) {
  const clash = await db.user.findFirst({ where: { email, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (clash) throw new UserError("That email already has an account", { email: "Already in use" });
}

export const inviteMemberAction = defineAction({
  schema: memberInputSchema,
  authorize: (user, input) => can(user, "create", { type: "team", targetRole: input.role }),
  handler: async ({ user, input, meta }) => {
    await assertEmailFree(input.email);
    await assertPartner(input.partnerId);
    const ctc = has(user, "payroll.view_all") ? input.ctcAnnualPaise : null;
    const member = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          title: input.title || null,
          role: input.role,
          partnerId: input.role === "OWNER" ? null : input.partnerId,
          dateOfJoining: input.dateOfJoining ? isoToDate(input.dateOfJoining) : null,
          ctcAnnualPaise: ctc === null ? null : BigInt(ctc),
          active: true,
        },
      });
      await sendInvite(tx, user, created);
      await writeAudit(tx, {
        actor: user,
        module: "Teams",
        action: "create",
        text: `${user.name} added ${created.name} to the team`,
        entityType: "User",
        entityId: created.id,
        after: { name: created.name, email: created.email, role: created.role, title: created.title, partnerId: created.partnerId, dateOfJoining: input.dateOfJoining, ctcAnnualPaise: ctc },
        meta,
        visibility: "PUBLIC",
        feed: true,
      });
      return created;
    });
    refresh();
    return ok(`${member.name} added · welcome email sent to ${member.email}`, { id: member.id });
  },
});

export const updateMemberAction = defineAction({
  schema: z.object({ id: z.uuid(), data: memberInputSchema, active: z.boolean() }),
  authorize: (user) => has(user, "teams.manage"),
  handler: async ({ user, input, meta }) => {
    const before = await db.user.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!before) throw new UserError("This member no longer exists");
    assertCan(user, "update", { type: "team", targetRole: before.role, targetId: before.id });
    if (input.data.role === "OWNER" && !isOwner(user)) throw new UserError("Only partners can make someone an owner");
    if (before.id === user.id && (input.data.role !== before.role || !input.active)) throw new UserError("You can't change your own access or deactivate yourself");
    if (input.data.email !== before.email) await assertEmailFree(input.data.email, before.id);
    await assertPartner(input.data.partnerId);

    const seeCtc = has(user, "payroll.view_all");
    const deactivating = before.active && !input.active;
    const roleChanged = before.role !== input.data.role;
    const after = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: before.id },
        data: {
          name: input.data.name,
          email: input.data.email,
          phone: input.data.phone,
          title: input.data.title || null,
          role: input.data.role,
          partnerId: input.data.role === "OWNER" ? null : input.data.partnerId,
          dateOfJoining: input.data.dateOfJoining ? isoToDate(input.data.dateOfJoining) : null,
          ...(seeCtc ? { ctcAnnualPaise: input.data.ctcAnnualPaise === null ? null : BigInt(input.data.ctcAnnualPaise) } : {}),
          active: input.active,
          // Deactivation and access changes take effect immediately: every open session is invalidated.
          ...(deactivating || roleChanged ? { sessionVersion: { increment: 1 } } : {}),
        },
      });
      await writeAudit(tx, {
        actor: user,
        module: "Teams",
        action: "update",
        text: deactivating ? `${user.name} deactivated ${updated.name}` : roleChanged ? `${user.name} changed ${updated.name}'s access to ${updated.role.toLowerCase()}` : `${user.name} updated ${updated.name}`,
        entityType: "User",
        entityId: updated.id,
        before,
        after: updated,
        meta,
      });
      return updated;
    });
    refresh();
    return ok(deactivating ? `${after.name} deactivated` : `${after.name} updated`);
  },
});

export const resendInviteAction = defineAction({
  schema: z.object({ id: z.uuid() }),
  authorize: (user) => has(user, "teams.manage"),
  handler: async ({ user, input, meta }) => {
    const member = await db.user.findFirst({ where: { id: input.id, deletedAt: null, active: true } });
    if (!member) throw new UserError("This member is not active");
    if (member.passwordHash) throw new UserError(`${member.name} has already set a password`);
    assertCan(user, "update", { type: "team", targetRole: member.role, targetId: member.id });
    await db.$transaction(async (tx) => {
      await sendInvite(tx, user, member);
      await writeAudit(tx, { actor: user, module: "Teams", action: "update", text: `${user.name} re-sent the invite to ${member.name}`, entityType: "User", entityId: member.id, meta });
    });
    return ok(`Invite re-sent to ${member.email}`);
  },
});
