"use server";

import { refresh } from "./refresh";
import { z } from "zod";
import { ok } from "@/lib/action-result";
import { WIP_REMARK } from "@/lib/constants";
import { isoToDate } from "@/lib/dates";
import { leadInputSchema, WIP_REMARK_VALUES } from "@/lib/schemas/wip";
import { estimatedFeesPaise } from "@/lib/wip";
import { writeAudit } from "../audit";
import { db } from "../db";
import { assertCan, can, has } from "../policy";
import { notify } from "../services/notify";
import { brokerUserIds, leadInclude } from "../services/wip";
import { onRemarkChanged } from "../services/wip-effects";
import { defineAction, UserError } from "./define";

type LeadInput = z.infer<typeof leadInputSchema>;

async function assertActiveUsers(ids: string[]) {
  if (!ids.length) return;
  const found = await db.user.count({ where: { id: { in: ids }, active: true, deletedAt: null } });
  if (found !== new Set(ids).size) throw new UserError("One of the selected brokers is no longer active");
}

function involvedIds(input: LeadInput): string[] {
  return [...input.primaryBrokerIds, ...input.secondaryBrokers.flatMap((b) => ("userId" in b ? [b.userId] : []))];
}

function brokerRows(input: LeadInput) {
  return [
    ...input.primaryBrokerIds.map((userId, position) => ({ role: "PRIMARY" as const, userId, externalName: null, position })),
    ...input.secondaryBrokers.map((b, position) => ({
      role: "SECONDARY" as const,
      userId: "userId" in b ? b.userId : null,
      externalName: "externalName" in b ? b.externalName : null,
      position,
    })),
  ];
}

function leadData(input: LeadInput) {
  return {
    tenantName: input.tenantName,
    pricingBasis: input.pricingBasis,
    areaSqft: input.pricingBasis === "PER_SQFT" ? input.areaSqft : null,
    seats: input.pricingBasis === "PER_SEAT" ? input.seats : null,
    ratePaise: BigInt(input.ratePaise),
    building: input.building || null,
    location: input.location,
    landlordType: input.landlordType,
    landlordName: input.landlordName || null,
    estFeesPaise: BigInt(estimatedFeesPaise(input.pricingBasis, input.ratePaise, input.areaSqft, input.seats)),
    closureDate: isoToDate(input.closureDate),
  };
}

export const createLeadAction = defineAction({
  schema: leadInputSchema,
  authorize: (user) => can(user, "create", { type: "wip" }),
  handler: async ({ user, input, meta }) => {
    const ids = involvedIds(input);
    if (!has(user, "wip.edit_all") && !ids.includes(user.id)) throw new UserError("Add yourself as a primary or secondary broker", { primaryBrokerIds: "Add yourself" });
    await assertActiveUsers(ids);
    const lead = await db.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: { ...leadData(input), remark: input.remark, createdById: user.id, brokers: { create: brokerRows(input) } },
        include: leadInclude,
      });
      await writeAudit(tx, {
        actor: user,
        module: "WIP",
        action: "create",
        text: `${user.name} added ${created.tenantName} to WIP`,
        entityType: "Lead",
        entityId: created.id,
        after: created,
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: brokerUserIds(created),
        feed: true,
      });
      await notify(tx, brokerUserIds(created), { kind: "wip", text: `${user.name} added you as a broker on ${created.tenantName}`, href: `/wip?focus=${created.id}` }, user.id);
      await onRemarkChanged(tx, user, created, "VISITS", created.remark);
      return created;
    });
    refresh();
    return ok(`${lead.tenantName} added to WIP`, { id: lead.id });
  },
});

export const updateLeadAction = defineAction({
  schema: z.object({ id: z.uuid(), data: leadInputSchema }),
  authorize: (user) => can(user, "update", { type: "wip", brokerUserIds: [user.id] }) || has(user, "wip.edit_all"),
  handler: async ({ user, input, meta }) => {
    const before = await db.lead.findFirst({ where: { id: input.id, deletedAt: null }, include: leadInclude });
    if (!before) throw new UserError("This WIP row no longer exists");
    assertCan(user, "update", { type: "wip", brokerUserIds: brokerUserIds(before) });
    const ids = involvedIds(input.data);
    if (!has(user, "wip.edit_all") && !ids.includes(user.id)) throw new UserError("You'd lose access to this row — keep yourself as a broker", { primaryBrokerIds: "Keep yourself" });
    await assertActiveUsers(ids.filter((id) => !brokerUserIds(before).includes(id)));

    const after = await db.$transaction(async (tx) => {
      await tx.leadBroker.deleteMany({ where: { leadId: before.id } });
      const updated = await tx.lead.update({
        where: { id: before.id },
        data: {
          ...leadData(input.data),
          remark: input.data.remark,
          ...(input.data.remark !== before.remark ? { remarkChangedAt: new Date() } : {}),
          brokers: { create: brokerRows(input.data) },
        },
        include: leadInclude,
      });
      await writeAudit(tx, {
        actor: user,
        module: "WIP",
        action: "update",
        text: input.data.remark !== before.remark ? `${user.name} moved ${updated.tenantName} to ${WIP_REMARK[updated.remark].label}` : `${user.name} updated ${updated.tenantName}`,
        entityType: "Lead",
        entityId: updated.id,
        before,
        after: updated,
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: [...new Set([...brokerUserIds(before), ...brokerUserIds(updated)])],
        feed: input.data.remark !== before.remark,
      });
      await onRemarkChanged(tx, user, updated, before.remark, updated.remark);
      return updated;
    });
    refresh();
    return ok(`${after.tenantName} updated`);
  },
});

export const setRemarkAction = defineAction({
  schema: z.object({ id: z.uuid(), remark: z.enum(WIP_REMARK_VALUES) }),
  authorize: (user) => can(user, "update", { type: "wip", brokerUserIds: [user.id] }) || has(user, "wip.edit_all"),
  handler: async ({ user, input, meta }) => {
    const lead = await db.lead.findFirst({ where: { id: input.id, deletedAt: null }, include: leadInclude });
    if (!lead) throw new UserError("This WIP row no longer exists");
    assertCan(user, "update", { type: "wip", brokerUserIds: brokerUserIds(lead) });
    if (lead.remark === input.remark) return ok();
    await db.$transaction(async (tx) => {
      await tx.lead.update({ where: { id: lead.id }, data: { remark: input.remark, remarkChangedAt: new Date() } });
      await writeAudit(tx, {
        actor: user,
        module: "WIP",
        action: "update",
        text: `${user.name} moved ${lead.tenantName} to ${WIP_REMARK[input.remark].label}`,
        entityType: "Lead",
        entityId: lead.id,
        before: { remark: lead.remark },
        after: { remark: input.remark },
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: brokerUserIds(lead),
        feed: true,
      });
      await onRemarkChanged(tx, user, lead, lead.remark, input.remark);
    });
    refresh();
    return ok(`${lead.tenantName} → ${WIP_REMARK[input.remark].label}`);
  },
});

export const deleteLeadAction = defineAction({
  schema: z.object({ id: z.uuid() }),
  authorize: (user) => can(user, "delete", { type: "wip", brokerUserIds: [] }),
  handler: async ({ user, input, meta }) => {
    const lead = await db.lead.findFirst({ where: { id: input.id, deletedAt: null }, include: leadInclude });
    if (!lead) throw new UserError("This WIP row no longer exists");
    await db.$transaction(async (tx) => {
      await tx.lead.update({ where: { id: lead.id }, data: { deletedAt: new Date() } });
      await writeAudit(tx, {
        actor: user,
        module: "WIP",
        action: "delete",
        text: `${user.name} removed ${lead.tenantName} from WIP`,
        entityType: "Lead",
        entityId: lead.id,
        before: lead,
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: brokerUserIds(lead),
      });
    });
    refresh();
    return ok(`${lead.tenantName} removed from WIP`);
  },
});
