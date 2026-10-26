import "server-only";
import type { WipRemark } from "@/generated/prisma/enums";
import { WIP_REMARK } from "@/lib/constants";
import { formatDate, isoDateIST } from "@/lib/dates";
import { formatCompactINR, toPaise } from "@/lib/money";
import { writeAudit } from "../audit";
import type { Tx } from "../db";
import type { SessionUser } from "../policy";
import type { RequestMeta } from "../request";
import { notify } from "./notify";
import { brokerUserIds, leadInclude } from "./wip";

type LeadForEffects = {
  id: string;
  tenantName: string;
  building: string | null;
  location: string;
  estFeesPaise: bigint;
  brokers: { role: string; userId: string | null; user: { name: string } | null; externalName: string | null }[];
};

/** Side effects of entering "Payment Collected": an achievement and a note to the brokers. */
export async function onRemarkChanged(tx: Tx, user: Pick<SessionUser, "name">, lead: LeadForEffects, from: WipRemark, to: WipRemark) {
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

/**
 * Moves a WIP row forward because of an invoicing event (raised → "Invoice Raised", fully paid →
 * "Payment Collected"). Never moves a row backwards, and leaves Lost rows alone.
 */
export async function advanceLeadRemark(tx: Tx, user: SessionUser, leadId: string, to: "INVOICE_RAISED" | "PAYMENT_COLLECTED", reason: string, meta?: RequestMeta) {
  const lead = await tx.lead.findFirst({ where: { id: leadId, deletedAt: null }, include: leadInclude });
  if (!lead || lead.remark === "LOST" || lead.remark === "PAYMENT_COLLECTED") return;
  if (to === "INVOICE_RAISED" && lead.remark === "INVOICE_RAISED") return;
  await tx.lead.update({ where: { id: lead.id }, data: { remark: to, remarkChangedAt: new Date() } });
  await writeAudit(tx, {
    actor: user,
    module: "WIP",
    action: "update",
    text: `${user.name} moved ${lead.tenantName} to ${WIP_REMARK[to].label} (${reason})`,
    entityType: "Lead",
    entityId: lead.id,
    before: { remark: lead.remark },
    after: { remark: to },
    meta,
    visibility: "RESTRICTED",
    subjectUserIds: brokerUserIds(lead),
    feed: true,
  });
  await onRemarkChanged(tx, user, lead, lead.remark, to);
}

/**
 * Undoes "Payment Collected" when the payment behind it is reversed — unless another invoice for the row
 * is still fully paid. The deal-closed achievement goes with it; the audit log keeps the history.
 */
export async function revertPaymentCollected(tx: Tx, user: SessionUser, leadId: string, reason: string, meta?: RequestMeta) {
  const lead = await tx.lead.findFirst({ where: { id: leadId, deletedAt: null }, include: leadInclude });
  if (!lead || lead.remark !== "PAYMENT_COLLECTED") return;
  if (await tx.invoice.count({ where: { leadId, type: "INVOICE", status: "PAID" } })) return;
  await tx.lead.update({ where: { id: lead.id }, data: { remark: "INVOICE_RAISED", remarkChangedAt: new Date() } });
  await tx.achievement.deleteMany({ where: { leadId: lead.id, kind: "DEAL_CLOSED" } });
  await writeAudit(tx, {
    actor: user,
    module: "WIP",
    action: "update",
    text: `${user.name} moved ${lead.tenantName} back to ${WIP_REMARK.INVOICE_RAISED.label} (${reason})`,
    entityType: "Lead",
    entityId: lead.id,
    before: { remark: lead.remark },
    after: { remark: "INVOICE_RAISED" },
    meta,
    visibility: "RESTRICTED",
    subjectUserIds: brokerUserIds(lead),
  });
}
