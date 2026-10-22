"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { WipRemark } from "@/generated/prisma/enums";
import { ok } from "@/lib/action-result";
import { WIP_REMARK } from "@/lib/constants";
import { formatDate, isoDateIST, isoToDate } from "@/lib/dates";
import { formatCompactINR, toPaise } from "@/lib/money";
import { leadInputSchema, WIP_REMARK_VALUES } from "@/lib/schemas/wip";
import { estimatedFeesPaise } from "@/lib/wip";
import { writeAudit } from "../audit";
import { db, type Tx } from "../db";
import { assertCan, can, has, type SessionUser } from "../policy";
import { notify } from "../services/notify";
import { brokerUserIds, leadInclude } from "../services/wip";
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

/** Side effects of entering "Payment Collected": an achievement and a note to the brokers. */
async function onRemarkChanged(tx: Tx, user: SessionUser, lead: { id: string; tenantName: string; building: string | null; location: string; estFeesPaise: bigint; brokers: { role: string; userId: string | null; user: { name: string } | null; externalName: string | null }[] }, from: WipRemark, to: WipRemark) {
  if (from === to || to !== "PAYMENT_COLLECTED") return;
  const primaries = lead.brokers.filter((b) => b.role === "PRIMARY");
  const names = primaries.map((b) => b.user?.name ?? b.externalName).filter(Boolean);
  await tx.achievement.create({
    data: {
      kind: "DEAL_CLOSED",
      userId: primaries.find((b) => b.userId)?.userId ?? null,
      leadId: lead.id,
      title: `${names.join(" & ") || user.name} closed ${lead.tenantName}`,
      meta: `${lead.building || lead.location} · ${formatDate(isoDateIST())}`,
      valuePaise: lead.estFeesPaise,
    },
  });
  await notify(tx, brokerUserIds(lead), { kind: "deal", text: `Payment collected — ${lead.tenantName} · ${formatCompactINR(toPaise(lead.estFeesPaise))}`, href: `/wip?focus=${lead.id}` });
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
