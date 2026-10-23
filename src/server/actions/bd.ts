"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { ok } from "@/lib/action-result";
import { TEMPERATURE } from "@/lib/constants";
import { addDaysIso, isoDateIST, isoToDate } from "@/lib/dates";
import { bdCommentSchema, bdMeetingInputSchema, bdMeetingUpdateSchema, bdTemperatureSchema, type BdMeetingInput } from "@/lib/schemas/bd";
import { writeAudit } from "../audit";
import { encryptOptional } from "../crypto";
import { db } from "../db";
import { assertCan, can, type SessionUser } from "../policy";
import { notify } from "../services/notify";
import { defineAction, UserError } from "./define";

type Parsed = z.infer<typeof bdMeetingInputSchema>;

/** Newly chosen brokers must be active (a meeting keeps a broker who has since left). */
async function assertBrokers(input: Parsed, before?: { primaryBrokerId: string; secondaryBrokerId: string | null }) {
  const kept = new Set([before?.primaryBrokerId, before?.secondaryBrokerId]);
  const ids = [input.primaryBrokerId, input.secondaryBrokerId].filter((id): id is string => Boolean(id) && !kept.has(id));
  const found = await db.user.count({ where: { id: { in: ids }, active: true, deletedAt: null } });
  if (found !== ids.length) throw new UserError("One of the selected brokers is no longer active");
  if (input.meetingDate > addDaysIso(isoDateIST(), 60)) throw new UserError("Pick a date within the next 60 days", { meetingDate: "Too far ahead" });
}

/** Columns from the form. Contact info is encrypted; `undefined` leaves the stored value alone. */
function columns(input: Parsed) {
  return {
    primaryBrokerId: input.primaryBrokerId,
    secondaryBrokerId: input.secondaryBrokerId,
    meetingDate: isoToDate(input.meetingDate),
    tenantName: input.tenantName,
    contactName: input.contactName,
    designation: input.designation || null,
    meetingType: input.meetingType,
    mode: input.mode,
    temperature: input.temperature,
    comments: input.comments || null,
    ...(input.phone !== undefined ? { clientPhoneEnc: encryptOptional(input.phone) } : {}),
    ...(input.email !== undefined ? { clientEmailEnc: encryptOptional(input.email) } : {}),
  };
}

/** Audit snapshots never carry client contact details, only whether they were given. */
function auditable(input: Parsed) {
  const { phone, email, ...rest } = input;
  return { ...rest, contactInfo: phone || email ? "provided" : phone === undefined && email === undefined ? "unchanged" : "cleared" };
}

const involved = (m: { primaryBrokerId: string; secondaryBrokerId: string | null }) => [m.primaryBrokerId, m.secondaryBrokerId].filter((id): id is string => Boolean(id));

export const createBdMeetingAction = defineAction({
  schema: bdMeetingInputSchema,
  authorize: (user) => can(user, "create", { type: "bd" }),
  handler: async ({ user, input, meta }) => {
    await assertBrokers(input);
    const meeting = await db.$transaction(async (tx) => {
      const created = await tx.bdMeeting.create({ data: { ...columns(input), createdById: user.id } });
      await writeAudit(tx, {
        actor: user,
        module: "Business Development",
        action: "create",
        text: `${user.name} logged a meeting with ${input.tenantName}`,
        entityType: "BdMeeting",
        entityId: created.id,
        after: auditable(input),
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: involved(created),
        feed: true,
      });
      await notify(tx, involved(created), { kind: "bd", text: `${user.name} logged a meeting with ${input.tenantName} and added you`, href: `/business-development?focus=${created.id}` }, user.id);
      return created;
    });
    refresh();
    return ok(`Meeting with ${input.tenantName} added`, { id: meeting.id });
  },
});

async function loadForUpdate(user: SessionUser, id: string) {
  const meeting = await db.bdMeeting.findFirst({ where: { id, deletedAt: null } });
  if (!meeting) throw new UserError("That meeting no longer exists");
  assertCan(user, "update", { type: "bd", primaryBrokerId: meeting.primaryBrokerId, secondaryBrokerId: meeting.secondaryBrokerId, createdById: meeting.createdById });
  return meeting;
}

export const updateBdMeetingAction = defineAction({
  schema: bdMeetingUpdateSchema,
  authorize: (user) => can(user, "create", { type: "bd" }),
  handler: async ({ user, input, meta }) => {
    const before = await loadForUpdate(user, input.id);
    await assertBrokers(input, before);
    // People who can't see contact info can add it but never clear what they can't see.
    const contact: Pick<BdMeetingInput, "phone" | "email"> = can(user, "view_contacts", { type: "bd" })
      ? { phone: input.phone, email: input.email }
      : { phone: input.phone || undefined, email: input.email || undefined };
    const next = { ...input, ...contact };
    await db.$transaction(async (tx) => {
      const updated = await tx.bdMeeting.update({ where: { id: before.id }, data: columns(next) });
      const { clientPhoneEnc: _p, clientEmailEnc: _e, ...beforeSafe } = before;
      await writeAudit(tx, {
        actor: user,
        module: "Business Development",
        action: "update",
        text: `${user.name} updated the meeting with ${input.tenantName}`,
        entityType: "BdMeeting",
        entityId: before.id,
        before: beforeSafe,
        after: auditable(next),
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: [...new Set([...involved(before), ...involved(updated)])],
      });
    });
    refresh();
    return ok(`Meeting with ${input.tenantName} updated`);
  },
});

export const setBdTemperatureAction = defineAction({
  schema: bdTemperatureSchema,
  authorize: (user) => can(user, "create", { type: "bd" }),
  handler: async ({ user, input, meta }) => {
    const before = await loadForUpdate(user, input.id);
    if (before.temperature === input.temperature) return ok();
    await db.$transaction(async (tx) => {
      await tx.bdMeeting.update({ where: { id: before.id }, data: { temperature: input.temperature } });
      await writeAudit(tx, {
        actor: user,
        module: "Business Development",
        action: "update",
        text: `${user.name} marked ${before.tenantName} ${TEMPERATURE[input.temperature].label}`,
        entityType: "BdMeeting",
        entityId: before.id,
        before: { temperature: before.temperature },
        after: { temperature: input.temperature },
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: involved(before),
        feed: input.temperature === "HOT",
      });
    });
    refresh();
    return ok(`${before.tenantName} marked ${TEMPERATURE[input.temperature].label}`);
  },
});

export const setBdCommentAction = defineAction({
  schema: bdCommentSchema,
  authorize: (user) => can(user, "create", { type: "bd" }),
  handler: async ({ user, input, meta }) => {
    const before = await loadForUpdate(user, input.id);
    if ((before.comments ?? "") === input.comments) return ok();
    await db.$transaction(async (tx) => {
      await tx.bdMeeting.update({ where: { id: before.id }, data: { comments: input.comments || null } });
      await writeAudit(tx, {
        actor: user,
        module: "Business Development",
        action: "update",
        text: `${user.name} updated comments on ${before.tenantName}`,
        entityType: "BdMeeting",
        entityId: before.id,
        before: { comments: before.comments },
        after: { comments: input.comments },
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: involved(before),
      });
    });
    refresh();
    return ok("Comments saved");
  },
});

export const deleteBdMeetingAction = defineAction({
  schema: z.object({ id: z.uuid() }),
  authorize: (user) => can(user, "delete", { type: "bd" }),
  handler: async ({ user, input, meta }) => {
    const meeting = await db.bdMeeting.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!meeting) throw new UserError("That meeting no longer exists");
    await db.$transaction(async (tx) => {
      await tx.bdMeeting.update({ where: { id: meeting.id }, data: { deletedAt: new Date() } });
      await writeAudit(tx, {
        actor: user,
        module: "Business Development",
        action: "delete",
        text: `${user.name} removed the meeting with ${meeting.tenantName}`,
        entityType: "BdMeeting",
        entityId: meeting.id,
        before: { tenantName: meeting.tenantName, contactName: meeting.contactName, meetingDate: meeting.meetingDate },
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: involved(meeting),
      });
    });
    refresh();
    return ok(`Meeting with ${meeting.tenantName} removed`);
  },
});
