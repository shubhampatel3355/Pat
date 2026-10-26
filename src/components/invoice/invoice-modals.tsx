"use client";

import { useState } from "react";
import { computeGst } from "@/lib/gstin";
import { PAYMENT_MODES } from "@/lib/invoice";
import { formatCompactINR, formatINR, paiseToInput, parseRupeesToPaise } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { issueCreditNoteAction, recordPaymentAction, reversePaymentAction } from "@/server/actions/invoices";
import type { InvoiceListRow } from "@/server/services/invoices";
import { Button } from "../ui/button";
import { FormError, inputClass } from "../ui/field";
import { Modal } from "../ui/overlay";
import { ChoiceChips } from "../ui/segmented";
import { useAction } from "../ui/toast";

type Mode = (typeof PAYMENT_MODES)[number]["value"];

export function PaymentModal({ invoice, today, onClose }: { invoice: { id: string; number: string; payeeName: string; outstandingPaise: number }; today: string; onClose: () => void }) {
  const [amount, setAmount] = useState(paiseToInput(invoice.outstandingPaise));
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<Mode>("NEFT");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const action = useAction(recordPaymentAction, { onSuccess: onClose, onError: (r) => setError(r.error) });
  const paise = parseRupeesToPaise(amount) ?? 0;
  const submit = () => {
    if (!paise) return setError("Enter the amount received");
    if (paise > invoice.outstandingPaise) return setError(`That's more than the ${formatINR(invoice.outstandingPaise)} outstanding`);
    void action.run({ invoiceId: invoice.id, amountPaise: paise, receivedOn: date, mode, reference });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Record payment"
      subtitle={`${invoice.payeeName} · ${invoice.number}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={action.pending}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="flex items-baseline justify-between rounded-[20px] bg-surface p-3.5">
        <span className="text-[13px] text-muted">Amount due</span>
        <span className="text-[28px] font-light">{formatINR(invoice.outstandingPaise)}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Amount received</span>
          <div className="flex h-11 items-center gap-2 rounded-[14px] bg-surface px-3.5 shadow-inset focus-within:shadow-focus">
            <span className="text-sm text-muted">₹</span>
            <input data-autofocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ""))} className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
          </div>
          <span className="text-[11px] text-placeholder">{paise ? `${formatINR(paise)} · ${formatCompactINR(paise)}` : "Indian format, no decimals"}</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Date received</span>
          <input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass("light", "h-11 px-3.5")} />
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Mode</span>
        <ChoiceChips label="Payment mode" options={PAYMENT_MODES} value={mode} onChange={(v) => setMode(v)} />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Reference / UTR</span>
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. HDFCN52026100612345" className={inputClass("light", "h-11 px-3.5")} />
      </label>
      <FormError message={error} />
    </Modal>
  );
}

export function CreditNoteModal({ invoice, companyStateCode, onClose }: { invoice: { id: string; number: string; payeeName: string; creditablePaise: number; gstin: string }; companyStateCode: string; onClose: () => void }) {
  const [amount, setAmount] = useState(paiseToInput(invoice.creditablePaise));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const action = useAction(issueCreditNoteAction, { onSuccess: onClose, onError: (r) => setError(r.error) });
  const paise = parseRupeesToPaise(amount) ?? 0;
  const gst = computeGst(paise, invoice.gstin.slice(0, 2), companyStateCode);
  const submit = () => {
    if (!paise) return setError("Enter the amount to credit");
    if (paise > invoice.creditablePaise) return setError(`At most ${formatINR(invoice.creditablePaise)} can be credited`);
    if (reason.trim().length < 2) return setError("Give a reason for the credit note");
    void action.run({ invoiceId: invoice.id, feesPaise: paise, reason });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Issue credit note"
      subtitle={`Against ${invoice.number} · ${invoice.payeeName}. Issued invoices can't be edited; a credit note reverses all or part of one.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={action.pending}>
            Issue credit note
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Amount to credit (₹, before GST)</span>
        <input data-autofocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ""))} className={inputClass("light", "h-11 px-3.5")} />
        <span className="text-[11px] text-muted">
          {gst.intraState ? "CGST 9% + SGST 9%" : "IGST 18%"} · total credit {formatINR(gst.totalPaise)} · up to {formatINR(invoice.creditablePaise)} before GST
        </span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Reason</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fee revised after LOI renegotiation" className={inputClass("light", "h-11 px-3.5")} />
      </label>
      <FormError message={error} />
    </Modal>
  );
}

const MODE_LABEL = Object.fromEntries(PAYMENT_MODES.map((m) => [m.value, m.label])) as Record<string, string>;

/** Payments received against an invoice; a payment recorded in error can be reversed with a reason. */
export function PaymentsModal({ invoice, canReverse, onClose }: { invoice: Pick<InvoiceListRow, "id" | "number" | "payeeName" | "payments" | "outstandingPaise">; canReverse: boolean; onClose: () => void }) {
  const [reversing, setReversing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const action = useAction(reversePaymentAction, { onSuccess: onClose, onError: (r) => setError(r.error) });
  const total = invoice.payments.reduce((a, p) => a + p.amountPaise, 0);
  const submit = () => {
    if (!reversing) return;
    if (reason.trim().length < 2) return setError("Say why this payment is being reversed");
    void action.run({ paymentId: reversing, reason });
  };
  return (
    <Modal open onClose={onClose} title="Payments" subtitle={`${invoice.payeeName} · ${invoice.number} · ${formatINR(total)} received · ${formatINR(invoice.outstandingPaise)} outstanding`}>
      <div className="flex flex-col gap-1">
        {invoice.payments.map((p) => (
          <div key={p.id} className="flex flex-col gap-2 rounded-row bg-surface px-3 py-2.5">
            <div className="flex items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm">
                  {formatDate(p.receivedOn)} · {MODE_LABEL[p.mode] ?? p.mode}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span className="text-[11px] text-muted">Recorded by {p.recordedBy}</span>
              </span>
              <span className="text-sm font-medium tabular-nums">{formatINR(p.amountPaise)}</span>
              {canReverse && reversing !== p.id && (
                <Button
                  variant="danger-soft"
                  size="sm"
                  onClick={() => {
                    setReversing(p.id);
                    setReason("");
                    setError(null);
                  }}
                >
                  Reverse
                </Button>
              )}
            </div>
            {reversing === p.id && (
              <div className="flex flex-col gap-2 border-t border-chip pt-2">
                <span className="text-xs text-muted">Reversing removes this receipt from the ledger and reopens the invoice. The audit log keeps the original.</span>
                <div className="flex gap-2">
                  <input data-autofocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. Recorded against the wrong invoice" className={inputClass("light", "h-10 flex-1 bg-raised px-3")} />
                  <Button variant="secondary" onClick={() => setReversing(null)}>
                    Keep
                  </Button>
                  <Button variant="danger-soft" loading={action.pending} onClick={submit}>
                    Reverse payment
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <FormError message={error} />
    </Modal>
  );
}
