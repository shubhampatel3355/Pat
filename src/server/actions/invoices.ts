"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { ok } from "@/lib/action-result";
import { formatDate, fyOfIso, isoDateIST, isoToDate } from "@/lib/dates";
import { computeGst } from "@/lib/gstin";
import { settledStatus } from "@/lib/invoice";
import { formatINR, toPaise } from "@/lib/money";
import { creditNoteInputSchema, invoiceInputSchema, paymentInputSchema, paymentReverseSchema, proformaInputSchema } from "@/lib/schemas/invoice";
import { writeAudit } from "../audit";
import { db, type Tx } from "../db";
import { documentEmail } from "../email/templates";
import { companyStateCode, env } from "../env";
import { enqueue, QUEUES } from "../queue";
import { can, has, type SessionUser } from "../policy";
import type { RequestMeta } from "../request";
import { allocateNumber, brokerName, createDocument, creditedPaise, invoiceInclude, type DocumentDraft, type InvoiceRow } from "../services/invoices";
import { managerIds, notify } from "../services/notify";
import { advanceLeadRemark, revertPaymentCollected } from "../services/wip-effects";
import { defineAction, UserError } from "./define";

const brokerUserIdsOf = (inv: { brokers: { userId: string | null }[] }) => inv.brokers.flatMap((b) => (b.userId ? [b.userId] : []));

async function assertBrokersActive(brokers: DocumentDraft["brokers"]) {
  const ids = brokers.flatMap((b) => ("userId" in b ? [b.userId] : []));
  if (!ids.length) return;
  const found = await db.user.count({ where: { id: { in: ids }, deletedAt: null } });
  if (found !== new Set(ids).size) throw new UserError("One of the selected brokers no longer exists");
}

async function assertLead(leadId: string | null) {
  if (!leadId) return;
  const lead = await db.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true } });
  if (!lead) throw new UserError("The linked WIP row no longer exists");
}

async function auditDocument(tx: Tx, user: SessionUser, inv: InvoiceRow, text: string, meta: RequestMeta, feed = false) {
  await writeAudit(tx, {
    actor: user,
    module: "Invoices",
    action: "create",
    text,
    entityType: "Invoice",
    entityId: inv.id,
    after: inv,
    meta,
    visibility: "RESTRICTED",
    subjectUserIds: brokerUserIdsOf(inv),
    feed,
  });
}

export const raiseInvoiceAction = defineAction({
  schema: invoiceInputSchema,
  authorize: (user) => can(user, "create", { type: "invoice" }),
  handler: async ({ user, input, meta }) => {
    await assertBrokersActive(input.brokers);
    await assertLead(input.leadId);
    const inv = await db.$transaction(async (tx) => {
      const created = await createDocument(tx, user, "INVOICE", input);
      await auditDocument(tx, user, created, `${user.name} raised an invoice for ${created.payeeName}`, meta, true);
      if (created.leadId) await advanceLeadRemark(tx, user, created.leadId, "INVOICE_RAISED", `invoice ${created.number}`, meta);
      await notify(tx, brokerUserIdsOf(created), { kind: "invoice", text: `Invoice ${created.number} raised to ${created.payeeName}`, href: `/invoices?focus=${created.id}` }, user.id);
      return created;
    });
    refresh();
    return ok(`${inv.number} raised to ${inv.payeeName} · ${formatINR(toPaise(inv.totalPaise))}`, { id: inv.id, number: inv.number });
  },
});

export const createProformaAction = defineAction({
  schema: proformaInputSchema,
  authorize: (user) => can(user, "create", { type: "invoice" }),
  handler: async ({ user, input, meta }) => {
    await assertBrokersActive(input.brokers);
    await assertLead(input.leadId);
    const pf = await db.$transaction(async (tx) => {
      const created = await createDocument(tx, user, "PROFORMA", input, { validityDays: input.validityDays });
      await auditDocument(tx, user, created, `${user.name} created proforma ${created.number} for ${created.payeeName}`, meta);
      return created;
    });
    refresh();
    return ok(`Proforma ${pf.number} created for ${pf.payeeName} · ${formatINR(toPaise(pf.totalPaise))}`, { id: pf.id, number: pf.number });
  },
});

export const convertProformaAction = defineAction({
  schema: z.object({ id: z.uuid() }),
  authorize: (user) => can(user, "create", { type: "invoice" }),
  handler: async ({ user, input, meta }) => {
    const pf = await db.invoice.findFirst({ where: { id: input.id, type: "PROFORMA" }, include: invoiceInclude });
    if (!pf) throw new UserError("Proforma not found");
    if (pf.status !== "OPEN") throw new UserError(`${pf.number} has already been ${pf.status === "CONVERTED" ? "converted" : "cancelled"}`);
    if (!pf.gstin) throw new UserError("Add the payee's GSTIN before converting");
    const inv = await db.$transaction(async (tx) => {
      // Re-check inside the transaction so two clicks can't convert twice.
      const claimed = await tx.invoice.updateMany({ where: { id: pf.id, status: "OPEN" }, data: { status: "CONVERTED" } });
      if (claimed.count !== 1) throw new UserError(`${pf.number} was converted a moment ago`);
      const created = await createDocument(
        tx,
        user,
        "INVOICE",
        {
          payeeName: pf.payeeName,
          billingAddress: pf.billingAddress,
          gstin: pf.gstin!,
          narration: pf.narration ?? "",
          paymentTerms: pf.paymentTerms,
          mobile: pf.mobile,
          email: pf.email,
          feesPaise: toPaise(pf.feesPaise),
          leadId: pf.leadId,
          brokers: pf.brokers.map((b) => (b.userId ? { userId: b.userId, sharePct: b.sharePct } : { externalName: b.externalName!, sharePct: b.sharePct })),
        },
        { convertedFromId: pf.id },
      );
      await auditDocument(tx, user, created, `${user.name} converted ${pf.number} to invoice ${created.number}`, meta, true);
      if (created.leadId) await advanceLeadRemark(tx, user, created.leadId, "INVOICE_RAISED", `invoice ${created.number}`, meta);
      return created;
    });
    refresh();
    return ok(`${pf.number} converted to invoice ${inv.number}`, { id: inv.id, number: inv.number });
  },
});

export const recordPaymentAction = defineAction({
  schema: paymentInputSchema,
  authorize: (user) => can(user, "record", { type: "invoice" }),
  handler: async ({ user, input, meta }) => {
    if (input.receivedOn > isoDateIST()) throw new UserError("The date received can't be in the future");
    const result = await db.$transaction(async (tx) => {
      // Lock the invoice row so concurrent payments can't over-collect.
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${input.invoiceId}::uuid FOR UPDATE`;
      const inv = await tx.invoice.findFirst({ where: { id: input.invoiceId, type: "INVOICE" }, include: invoiceInclude });
      if (!inv) throw new UserError("Invoice not found");
      if (inv.status === "CREDITED") throw new UserError(`${inv.number} has been fully credited`);
      const total = toPaise(inv.totalPaise);
      const paid = toPaise(inv.amountPaidPaise);
      const credited = creditedPaise(inv);
      const outstanding = total - paid - credited;
      if (outstanding <= 0) throw new UserError(`${inv.number} is already settled`);
      if (input.amountPaise > outstanding) throw new UserError(`That's more than the ${formatINR(outstanding)} outstanding`, { amountPaise: "Too much" });

      const payment = await tx.payment.create({
        data: { invoiceId: inv.id, amountPaise: BigInt(input.amountPaise), receivedOn: isoToDate(input.receivedOn), mode: input.mode, reference: input.reference || null, recordedById: user.id },
      });
      await tx.ledgerEntry.create({
        data: {
          type: "INCOME",
          category: "Brokerage",
          description: `Payment — ${inv.number} · ${inv.payeeName}`,
          party: inv.payeeName,
          mode: input.mode,
          amountPaise: BigInt(input.amountPaise),
          entryDate: isoToDate(input.receivedOn),
          paymentId: payment.id,
          createdById: user.id,
        },
      });
      const newPaid = paid + input.amountPaise;
      const creditedFees = inv.creditNotes.reduce((a, c) => a + toPaise(c.feesPaise), 0);
      const status = settledStatus(total, newPaid, credited, creditedFees, toPaise(inv.feesPaise));
      await tx.invoice.update({ where: { id: inv.id }, data: { amountPaidPaise: BigInt(newPaid), status } });
      await writeAudit(tx, {
        actor: user,
        module: "Finance",
        action: "create",
        text: `${user.name} recorded ${formatINR(input.amountPaise)} against ${inv.number} (${inv.payeeName})`,
        entityType: "Payment",
        entityId: payment.id,
        after: { invoice: inv.number, amountPaise: input.amountPaise, receivedOn: input.receivedOn, mode: input.mode, reference: input.reference, status },
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: brokerUserIdsOf(inv),
      });
      if (status === "PAID") {
        await notify(tx, [...brokerUserIdsOf(inv), ...(await managerIds(tx))], { kind: "payment", text: `Payment received — ${inv.number} · ${inv.payeeName} fully paid`, href: `/invoices?focus=${inv.id}` }, user.id);
        if (inv.leadId) await advanceLeadRemark(tx, user, inv.leadId, "PAYMENT_COLLECTED", `${inv.number} paid`, meta);
      }
      return { inv, status };
    });
    refresh();
    return ok(`${formatINR(input.amountPaise)} recorded against ${result.inv.number}${result.status === "PAID" ? " · fully paid" : ""}`);
  },
});

export const reversePaymentAction = defineAction({
  schema: paymentReverseSchema,
  authorize: (user) => can(user, "record", { type: "invoice" }),
  handler: async ({ user, input, meta }) => {
    const result = await db.$transaction(async (tx) => {
      const pay = await tx.payment.findUnique({ where: { id: input.paymentId } });
      if (!pay || pay.voidedAt) throw new UserError("That payment has already been reversed");
      // Lock the invoice so a payment and a reversal can't interleave.
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${pay.invoiceId}::uuid FOR UPDATE`;
      const inv = await tx.invoice.findFirstOrThrow({ where: { id: pay.invoiceId }, include: invoiceInclude });
      const voided = await tx.payment.updateMany({ where: { id: pay.id, voidedAt: null }, data: { voidedAt: new Date(), voidedById: user.id, voidReason: input.reason } });
      if (!voided.count) throw new UserError("That payment has already been reversed");
      await tx.ledgerEntry.updateMany({ where: { paymentId: pay.id, deletedAt: null }, data: { deletedAt: new Date() } });
      const paid = Math.max(0, toPaise(inv.amountPaidPaise) - toPaise(pay.amountPaise));
      const creditedFees = inv.creditNotes.reduce((a, c) => a + toPaise(c.feesPaise), 0);
      const status = settledStatus(toPaise(inv.totalPaise), paid, creditedPaise(inv), creditedFees, toPaise(inv.feesPaise));
      await tx.invoice.update({ where: { id: inv.id }, data: { amountPaidPaise: BigInt(paid), status } });
      if (inv.status === "PAID" && status !== "PAID" && inv.leadId) await revertPaymentCollected(tx, user, inv.leadId, `${inv.number} payment reversed`, meta);
      await writeAudit(tx, {
        actor: user,
        module: "Finance",
        action: "delete",
        text: `${user.name} reversed the ${formatINR(toPaise(pay.amountPaise))} payment on ${inv.number} (${inv.payeeName}). Reason: ${input.reason}`,
        entityType: "Payment",
        entityId: pay.id,
        before: pay,
        after: { voided: true, reason: input.reason, invoiceStatus: status },
        meta,
        visibility: "RESTRICTED",
        subjectUserIds: brokerUserIdsOf(inv),
      });
      await notify(tx, [...brokerUserIdsOf(inv), ...(await managerIds(tx))], { kind: "payment", text: `Payment reversed — ${inv.number} · ${inv.payeeName} (${input.reason})`, href: `/invoices?focus=${inv.id}` }, user.id);
      return { inv, amount: toPaise(pay.amountPaise) };
    });
    refresh();
    return ok(`${formatINR(result.amount)} payment on ${result.inv.number} reversed`);
  },
});

export const issueCreditNoteAction = defineAction({
  schema: creditNoteInputSchema,
  authorize: (user) => can(user, "credit_note", { type: "invoice" }),
  handler: async ({ user, input, meta }) => {
    const cn = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${input.invoiceId}::uuid FOR UPDATE`;
      const inv = await tx.invoice.findFirst({ where: { id: input.invoiceId, type: "INVOICE" }, include: invoiceInclude });
      if (!inv) throw new UserError("Invoice not found");
      const fees = toPaise(inv.feesPaise);
      const creditedFees = inv.creditNotes.reduce((a, c) => a + toPaise(c.feesPaise), 0);
      const creditable = fees - creditedFees;
      if (creditable <= 0) throw new UserError(`${inv.number} has already been fully credited`);
      if (input.feesPaise > creditable) throw new UserError(`At most ${formatINR(creditable)} (before GST) can still be credited`);

      const issue = isoDateIST();
      const fy = fyOfIso(issue);
      const { seq, number } = await allocateNumber(tx, "CREDIT_NOTE", fy);
      const gst = computeGst(input.feesPaise, inv.placeOfSupply, companyStateCode());
      const created = await tx.invoice.create({
        data: {
          type: "CREDIT_NOTE",
          number,
          fy: fy.short,
          seq,
          status: "ISSUED",
          issueDate: isoToDate(issue),
          payeeName: inv.payeeName,
          billingAddress: inv.billingAddress,
          gstin: inv.gstin,
          placeOfSupply: inv.placeOfSupply,
          narration: `Credit against ${inv.number}${inv.narration ? ` — ${inv.narration}` : ""}`,
          paymentTerms: "—",
          mobile: inv.mobile,
          email: inv.email,
          feesPaise: BigInt(input.feesPaise),
          cgstPaise: BigInt(gst.cgstPaise),
          sgstPaise: BigInt(gst.sgstPaise),
          igstPaise: BigInt(gst.igstPaise),
          totalPaise: BigInt(gst.totalPaise),
          creditNoteForId: inv.id,
          reason: input.reason,
          leadId: inv.leadId,
          createdById: user.id,
          // Same broker split, so revenue attribution nets out per person.
          brokers: { create: inv.brokers.map((b, position) => ({ userId: b.userId, externalName: b.externalName, sharePct: b.sharePct, position })) },
        },
        include: invoiceInclude,
      });
      const status = settledStatus(toPaise(inv.totalPaise), toPaise(inv.amountPaidPaise), creditedPaise(inv) + gst.totalPaise, creditedFees + input.feesPaise, fees);
      await tx.invoice.update({ where: { id: inv.id }, data: { status } });
      await auditDocument(tx, user, created, `${user.name} issued credit note ${created.number} against ${inv.number} (${formatINR(gst.totalPaise)})`, meta);
      return created;
    });
    refresh();
    return ok(`Credit note ${cn.number} issued`, { id: cn.id });
  },
});

export const emailDocumentAction = defineAction({
  schema: z.object({ id: z.uuid() }),
  authorize: (user) => has(user, "invoices.create"),
  handler: async ({ user, input, meta }) => {
    const inv = await db.invoice.findUnique({ where: { id: input.id }, include: invoiceInclude });
    if (!inv) throw new UserError("Document not found");
    const company = env().COMPANY_LEGAL_NAME;
    const kind = inv.type === "PROFORMA" ? "proforma invoice" : inv.type === "CREDIT_NOTE" ? "credit note" : "invoice";
    const mail = documentEmail({
      greetingName: inv.payeeName,
      heading: `${kind[0]!.toUpperCase()}${kind.slice(1)} ${inv.number}`,
      lines: [
        `Please find attached ${kind} ${inv.number} dated ${formatDate(inv.issueDate.toISOString().slice(0, 10))} for ${formatINR(toPaise(inv.totalPaise))} (incl. GST).`,
        ...(inv.type === "INVOICE" ? [`Payment terms: ${inv.paymentTerms}.`] : []),
        ...(inv.brokers.length ? [`Handled by ${inv.brokers.map(brokerName).join(", ")}.`] : []),
        `Regards,\n${company}`,
      ],
      footnote: inv.type === "PROFORMA" ? "This proforma is not a tax invoice; a tax invoice will follow on acceptance." : undefined,
    });
    await db.$transaction(async (tx) => {
      await enqueue(
        QUEUES.email,
        {
          to: inv.email,
          replyTo: env().COMPANY_EMAIL,
          subject: `${kind[0]!.toUpperCase()}${kind.slice(1)} ${inv.number} — ${company}`,
          html: mail.html,
          text: mail.text,
          attachments: [{ kind: "invoice-pdf", invoiceId: inv.id }],
          audit: { module: "Invoices", entityType: "Invoice", entityId: inv.id },
        },
        { tx },
      );
      await writeAudit(tx, { actor: user, module: "Invoices", action: "email", text: `${user.name} emailed ${inv.number} to ${inv.email}`, entityType: "Invoice", entityId: inv.id, meta });
    });
    return ok(`${inv.number} is on its way to ${inv.email}`);
  },
});
