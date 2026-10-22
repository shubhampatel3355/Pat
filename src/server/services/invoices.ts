import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { InvoiceStatus, InvoiceType } from "@/generated/prisma/enums";
import type { InvoiceDocData } from "@/lib/company";
import { addDaysIso, dateToIso, financialYear, formatDate, fyOfIso, isoDateIST, isoToDate, type FinancialYear } from "@/lib/dates";
import { computeGst, STATE_NAMES } from "@/lib/gstin";
import { dueDateFromTerms, formatDocNumber, invoiceStatusDisplay } from "@/lib/invoice";
import { formatINR, sharePaise, toPaise } from "@/lib/money";
import { formatMobile } from "@/lib/schemas/common";
import { db, type Tx } from "../db";
import { companyStateCode } from "../env";
import { has, type SessionUser } from "../policy";

export const invoiceInclude = {
  brokers: { orderBy: { position: "asc" as const }, include: { user: { select: { id: true, name: true } } } },
  creditNoteFor: { select: { number: true } },
  creditNotes: { select: { feesPaise: true, totalPaise: true } },
  convertedTo: { select: { id: true, number: true } },
  files: { where: { deletedAt: null }, select: { id: true, name: true, sizeBytes: true } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

// ── Numbering ─────────────────────────────────────────────────────────────────

/**
 * Allocates the next number for a document kind in a financial year. The counter row is updated
 * (and therefore locked) inside the caller's transaction, so numbers are strictly sequential and
 * gap-free: a rolled-back invoice also rolls back its number, and concurrent issuers wait their turn.
 */
export async function allocateNumber(tx: Tx, type: InvoiceType, fy: FinancialYear): Promise<{ seq: number; number: string }> {
  await tx.$executeRaw`
    INSERT INTO document_sequences (kind, fy, next_value, updated_at)
    VALUES (${type}::"DocumentKind", ${fy.short}, 1, now())
    ON CONFLICT (kind, fy) DO NOTHING`;
  const rows = await tx.$queryRaw<{ seq: number }[]>`
    UPDATE document_sequences SET next_value = next_value + 1, updated_at = now()
    WHERE kind = ${type}::"DocumentKind" AND fy = ${fy.short}
    RETURNING next_value - 1 AS seq`;
  const seq = Number(rows[0]!.seq);
  return { seq, number: formatDocNumber(type, fy.short, seq) };
}

/** The number the next document would get (display only — the real one is allocated on save). */
export async function peekNumber(type: InvoiceType, today = isoDateIST()): Promise<string> {
  const fy = fyOfIso(today);
  const row = await db.documentSequence.findUnique({ where: { kind_fy: { kind: type, fy: fy.short } } });
  return formatDocNumber(type, fy.short, row?.nextValue ?? 1);
}

// ── Amounts ───────────────────────────────────────────────────────────────────

export function creditedPaise(inv: { creditNotes: { totalPaise: bigint }[] }): number {
  return inv.creditNotes.reduce((a, c) => a + toPaise(c.totalPaise), 0);
}

export function outstandingPaise(inv: Pick<InvoiceRow, "type" | "totalPaise" | "amountPaidPaise"> & { creditNotes: { totalPaise: bigint }[] }): number {
  if (inv.type !== "INVOICE") return 0;
  return Math.max(0, toPaise(inv.totalPaise) - toPaise(inv.amountPaidPaise) - creditedPaise(inv));
}

// ── Documents (printable data) ────────────────────────────────────────────────

export function brokerName(b: { user: { name: string } | null; externalName: string | null }): string {
  return b.user?.name ?? b.externalName ?? "—";
}

export function toDocData(inv: InvoiceRow): InvoiceDocData {
  const fees = toPaise(inv.feesPaise);
  const intra = toPaise(inv.igstPaise) === 0;
  const totalLabel = inv.type === "PROFORMA" ? "Total (proforma)" : inv.type === "CREDIT_NOTE" ? "Total credit" : "Total payable";
  return {
    kind: inv.type,
    number: inv.number,
    draft: false,
    date: formatDate(dateToIso(inv.issueDate)),
    validUntil: inv.validUntil ? formatDate(dateToIso(inv.validUntil)) : null,
    dueDate: inv.dueDate ? formatDate(dateToIso(inv.dueDate)) : null,
    payeeName: inv.payeeName,
    billingAddress: inv.billingAddress,
    gstin: inv.gstin ?? "—",
    placeOfSupply: `${STATE_NAMES[inv.placeOfSupply] ?? "—"} (${inv.placeOfSupply})`,
    contact: [inv.mobile ? `+91 ${formatMobile(inv.mobile)}` : "", inv.email].filter(Boolean).join(" · ") || "—",
    paymentTerms: inv.paymentTerms,
    narration: inv.narration || "—",
    fees: formatINR(fees),
    lines: intra
      ? [
          { label: "CGST 9%", value: formatINR(toPaise(inv.cgstPaise)) },
          { label: "SGST 9%", value: formatINR(toPaise(inv.sgstPaise)) },
          { label: totalLabel, value: formatINR(toPaise(inv.totalPaise)), strong: true },
        ]
      : [
          { label: "IGST 18%", value: formatINR(toPaise(inv.igstPaise)) },
          { label: totalLabel, value: formatINR(toPaise(inv.totalPaise)), strong: true },
        ],
    brokers: inv.brokers.map((b) => ({ name: brokerName(b), pct: b.sharePct })),
    reference: inv.type === "CREDIT_NOTE" ? `Against invoice ${inv.creditNoteFor?.number ?? "—"}${inv.reason ? ` · ${inv.reason}` : ""}` : null,
  };
}

// ── Creation ──────────────────────────────────────────────────────────────────

export interface DocumentDraft {
  payeeName: string;
  billingAddress: string;
  gstin: string;
  narration: string;
  paymentTerms: string;
  mobile: string;
  email: string;
  feesPaise: number;
  brokers: ({ userId: string; sharePct: number } | { externalName: string; sharePct: number })[];
  leadId: string | null;
}

export async function createDocument(tx: Tx, user: SessionUser, type: "INVOICE" | "PROFORMA", d: DocumentDraft, opts: { validityDays?: number; convertedFromId?: string; issueDate?: string } = {}) {
  const issue = opts.issueDate ?? isoDateIST();
  const fy = fyOfIso(issue);
  const { seq, number } = await allocateNumber(tx, type, fy);
  const placeOfSupply = d.gstin.slice(0, 2);
  const gst = computeGst(d.feesPaise, placeOfSupply, companyStateCode());
  return tx.invoice.create({
    data: {
      type,
      number,
      fy: fy.short,
      seq,
      status: type === "INVOICE" ? "ISSUED" : "OPEN",
      issueDate: isoToDate(issue),
      dueDate: type === "INVOICE" ? isoToDate(dueDateFromTerms(d.paymentTerms, issue)) : null,
      validUntil: type === "PROFORMA" ? isoToDate(addDaysIso(issue, opts.validityDays ?? 15)) : null,
      payeeName: d.payeeName,
      billingAddress: d.billingAddress,
      gstin: d.gstin,
      placeOfSupply,
      narration: d.narration || null,
      paymentTerms: d.paymentTerms,
      mobile: d.mobile,
      email: d.email,
      feesPaise: BigInt(d.feesPaise),
      cgstPaise: BigInt(gst.cgstPaise),
      sgstPaise: BigInt(gst.sgstPaise),
      igstPaise: BigInt(gst.igstPaise),
      totalPaise: BigInt(gst.totalPaise),
      leadId: d.leadId,
      convertedFromId: opts.convertedFromId ?? null,
      createdById: user.id,
      brokers: {
        create: d.brokers.map((b, position) => ({
          userId: "userId" in b ? b.userId : null,
          externalName: "externalName" in b ? b.externalName : null,
          sharePct: b.sharePct,
          position,
        })),
      },
    },
    include: invoiceInclude,
  });
}

// ── Listing ───────────────────────────────────────────────────────────────────

export interface InvoiceListRow {
  id: string;
  type: InvoiceType;
  number: string;
  payeeName: string;
  narration: string;
  gstin: string;
  paymentTerms: string;
  totalPaise: number;
  outstandingPaise: number;
  issueDate: string;
  validUntil: string | null;
  status: { label: string; color: string };
  rawStatus: InvoiceStatus;
  convertedToNumber: string | null;
  doc: InvoiceDocData;
  email: string;
  files: { id: string; name: string; sizeBytes: number }[];
  creditablePaise: number;
}

export async function listDocuments(user: SessionUser, kinds: InvoiceType[]): Promise<InvoiceListRow[]> {
  if (!has(user, "invoices.view")) return [];
  const today = isoDateIST();
  const rows = await db.invoice.findMany({ where: { type: { in: kinds } }, orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }], include: invoiceInclude, take: 500 });
  return rows.map((r) => {
    const creditedFees = r.creditNotes.reduce((a, c) => a + toPaise(c.feesPaise), 0);
    return {
      id: r.id,
      type: r.type,
      number: r.number,
      payeeName: r.payeeName,
      narration: r.narration ?? "—",
      gstin: r.gstin ?? "—",
      paymentTerms: r.type === "CREDIT_NOTE" ? (r.reason ?? "—") : r.paymentTerms,
      totalPaise: toPaise(r.totalPaise),
      outstandingPaise: outstandingPaise(r),
      issueDate: dateToIso(r.issueDate),
      validUntil: r.validUntil ? dateToIso(r.validUntil) : null,
      status: invoiceStatusDisplay(r.type, r.status, { validUntil: r.validUntil ? dateToIso(r.validUntil) : null, dueDate: r.dueDate ? dateToIso(r.dueDate) : null, today }),
      rawStatus: r.status,
      convertedToNumber: r.convertedTo?.number ?? null,
      doc: toDocData(r),
      email: r.email,
      files: r.files,
      creditablePaise: r.type === "INVOICE" && r.status !== "CREDITED" ? Math.max(0, toPaise(r.feesPaise) - creditedFees) : 0,
    };
  });
}

/** Summary line under the list header: "3 invoices raised · ₹ 12,36,640 billed · next PM/26-27/0115". */
export async function invoiceMeta(today = isoDateIST()) {
  const fy = fyOfIso(today);
  const [count, sum, next] = await Promise.all([
    db.invoice.count({ where: { type: "INVOICE", fy: fy.short } }),
    db.invoice.aggregate({ where: { type: "INVOICE", fy: fy.short }, _sum: { totalPaise: true } }),
    peekNumber("INVOICE", today),
  ]);
  return { count, billedPaise: toPaise(sum._sum.totalPaise ?? BigInt(0)), next, fyLabel: financialYear(fy.startYear).label };
}

export function brokerSharesForUsers(inv: { feesPaise: bigint; brokers: { userId: string | null; sharePct: number }[] }): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of inv.brokers) if (b.userId) out.set(b.userId, (out.get(b.userId) ?? 0) + sharePaise(toPaise(inv.feesPaise), b.sharePct));
  return out;
}
