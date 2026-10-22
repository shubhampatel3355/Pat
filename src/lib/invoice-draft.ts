import type { InvoiceDocData } from "./company";
import { addDaysIso, formatDate, isoDateIST } from "./dates";
import { computeGst, STATE_NAMES } from "./gstin";
import { dueDateFromTerms } from "./invoice";
import { formatINR } from "./money";

/** Document data for an unsaved form (the "Preview & print" button). */
export function draftDocData(
  companyStateCode: string,
  kind: "INVOICE" | "PROFORMA", input: { payeeName: string; billingAddress: string; gstin: string; narration: string; paymentTerms: string; mobile: string; email: string; feesPaise: number; validityDays?: number; brokers: { name: string; pct: number }[] }, number: string): InvoiceDocData {
  const today = isoDateIST();
  const gst = computeGst(input.feesPaise, input.gstin.slice(0, 2) || null, companyStateCode);
  const totalLabel = kind === "PROFORMA" ? "Total (proforma)" : "Total payable";
  const state = input.gstin.slice(0, 2) || companyStateCode;
  return {
    kind,
    number,
    draft: true,
    date: formatDate(today),
    validUntil: kind === "PROFORMA" ? formatDate(addDaysIso(today, input.validityDays ?? 15)) : null,
    dueDate: kind === "INVOICE" && input.paymentTerms ? formatDate(dueDateFromTerms(input.paymentTerms, today)) : null,
    payeeName: input.payeeName || "—",
    billingAddress: input.billingAddress || "—",
    gstin: input.gstin || "—",
    placeOfSupply: `${STATE_NAMES[state] ?? "—"} (${state})`,
    contact: [input.mobile ? `+91 ${input.mobile}` : "", input.email].filter(Boolean).join(" · ") || "—",
    paymentTerms: input.paymentTerms || "—",
    narration: input.narration || "—",
    fees: formatINR(input.feesPaise),
    lines: gst.intraState
      ? [
          { label: "CGST 9%", value: formatINR(gst.cgstPaise) },
          { label: "SGST 9%", value: formatINR(gst.sgstPaise) },
          { label: totalLabel, value: formatINR(gst.totalPaise), strong: true },
        ]
      : [
          { label: "IGST 18%", value: formatINR(gst.igstPaise) },
          { label: totalLabel, value: formatINR(gst.totalPaise), strong: true },
        ],
    brokers: input.brokers,
    reference: null,
  };
}
