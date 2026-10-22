import type { InvoiceStatus, InvoiceType } from "@/generated/prisma/enums";
import { addDaysIso } from "./dates";

export const DOC_PREFIX: Record<InvoiceType, string> = { INVOICE: "PM", PROFORMA: "PF", CREDIT_NOTE: "CN" };

/** PM/26-27/0001 — numbered per financial year, per document kind. */
export function formatDocNumber(type: InvoiceType, fyShort: string, seq: number): string {
  return `${DOC_PREFIX[type]}/${fyShort}/${String(seq).padStart(4, "0")}`;
}

/** Invoice status after a payment or credit note (fully credited wins over paid). */
export function settledStatus(totalPaise: number, paidPaise: number, creditedTotalPaise: number, creditedFeesPaise: number, feesPaise: number): InvoiceStatus {
  if (creditedFeesPaise >= feesPaise) return "CREDITED";
  if (paidPaise + creditedTotalPaise >= totalPaise) return "PAID";
  if (paidPaise > 0) return "PARTIALLY_PAID";
  return "ISSUED";
}

/**
 * Due date from free-text payment terms: "Net 30", "30 days", "within 15 days" → +N days;
 * "due on receipt", "immediate", "advance" → same day; anything else (e.g. "50% on LOI") → +30 days.
 */
export function dueDateFromTerms(terms: string, issueIso: string): string {
  const t = terms.toLowerCase();
  if (/\b(on receipt|immediate|immediately|advance|upfront)\b/.test(t)) return issueIso;
  const m = t.match(/(\d{1,3})\s*(?:days?|d)\b/) ?? t.match(/\bnet\s*(\d{1,3})\b/);
  if (m) return addDaysIso(issueIso, Math.min(365, Number(m[1])));
  return addDaysIso(issueIso, 30);
}

export interface StatusDisplay {
  label: string;
  color: string;
}

export function invoiceStatusDisplay(type: InvoiceType, status: InvoiceStatus, opts: { validUntil?: string | null; today?: string; dueDate?: string | null } = {}): StatusDisplay {
  if (type === "CREDIT_NOTE") return { label: "Credit note", color: "#A8A8AD" };
  if (type === "PROFORMA") {
    if (status === "CONVERTED") return { label: "Converted", color: "#3E9B52" };
    if (status === "CANCELLED") return { label: "Cancelled", color: "#A8A8AD" };
    if (opts.validUntil && opts.today && opts.validUntil < opts.today) return { label: "Expired", color: "#A8A8AD" };
    return { label: "Proforma", color: "#E8B84A" };
  }
  switch (status) {
    case "PAID":
      return { label: "Paid", color: "#3E9B52" };
    case "PARTIALLY_PAID":
      return { label: "Part paid", color: "#F5B73B" };
    case "CREDITED":
      return { label: "Credited", color: "#A8A8AD" };
    default:
      if (opts.dueDate && opts.today && opts.dueDate < opts.today) return { label: "Overdue", color: "#C93C37" };
      return { label: "Raised", color: "#023E7D" };
  }
}

export const PAYMENT_MODES = [
  { value: "NEFT", label: "NEFT" },
  { value: "RTGS", label: "RTGS" },
  { value: "IMPS", label: "IMPS" },
  { value: "UPI", label: "UPI" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CARD", label: "Card" },
  { value: "CASH", label: "Cash" },
  { value: "OTHER", label: "Other" },
] as const;
