import { PAYMENT_MODES } from "@shared/invoice";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { errorText } from "@/api/client";
import { runAction, useAction, useInvoices } from "@/api/queries";
import type { PaymentMode } from "@/api/prisma-enums";
import type { InvoiceRow } from "@/api/types";
import { AmountField, DateField, Field, Select } from "@/components/ui/form";
import { EmptyState, ErrorState, Loading } from "@/components/ui/primitives";
import { FormScreen, Screen } from "@/components/ui/screen";
import { fieldErrors, param } from "@/lib/forms";
import { formatINR, paiseToInput, parseRupeesToPaise } from "@/lib/format";

/** Record a payment against an invoice (posts to the ledger; the invoice and WIP row update as on the web). */
export default function PaymentForm() {
  const params = useLocalSearchParams<{ invoiceId?: string }>();
  const q = useInvoices();
  if (q.isPending) return <Screen title="Payment" back><Loading /></Screen>;
  if (!q.data) return <Screen title="Payment" back><ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} /></Screen>;
  const inv = q.data.invoices.find((r) => r.id === param(params.invoiceId));
  if (!inv) return <Screen title="Payment" back><EmptyState icon="receipt" title="Invoice not found" /></Screen>;
  return <Form inv={inv} today={q.data.today} />;
}

function Form({ inv, today }: { inv: InvoiceRow; today: string }) {
  const record = useAction("invoices.recordPayment");
  const [amount, setAmount] = useState(paiseToInput(inv.outstandingPaise));
  const [date, setDate] = useState<string | null>(today);
  const [mode, setMode] = useState<PaymentMode>("NEFT");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save() {
    const res = await runAction(record, { invoiceId: inv.id, amountPaise: parseRupeesToPaise(amount) ?? 0, receivedOn: date ?? "", mode, reference });
    if (res.ok) router.back();
    else setErrors(fieldErrors(res));
  }

  return (
    <FormScreen title="Record payment" sub={`${inv.number} · outstanding ${formatINR(inv.outstandingPaise)}`} onSubmit={save} saving={record.isPending}>
      <AmountField label="Amount received (incl. GST)" value={amount} onChange={setAmount} error={errors.amountPaise} />
      <DateField label="Received on" value={date} onChange={setDate} error={errors.receivedOn} />
      <Select<PaymentMode> label="Mode" value={mode} onChange={setMode} options={PAYMENT_MODES.map((m) => ({ value: m.value, label: m.label }))} />
      <Field label="Reference" value={reference} onChangeText={setReference} error={errors.reference} placeholder="UTR, cheque number…" autoCapitalize="characters" />
    </FormScreen>
  );
}
