import { computeGst } from "@shared/gstin";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { errorText } from "@/api/client";
import { runAction, useAction, useInvoices } from "@/api/queries";
import type { InvoiceRow } from "@/api/types";
import { AmountField, Field } from "@/components/ui/form";
import { Card, EmptyState, ErrorState, KeyValue, Loading } from "@/components/ui/primitives";
import { FormScreen, Screen } from "@/components/ui/screen";
import { fieldErrors, param } from "@/lib/forms";
import { formatINR, paiseToInput, parseRupeesToPaise } from "@/lib/format";

/** Issue a credit note against an invoice (fees excl. GST; GST follows the invoice's place of supply). */
export default function CreditNoteForm() {
  const params = useLocalSearchParams<{ invoiceId?: string }>();
  const q = useInvoices();
  if (q.isPending) return <Screen title="Credit note" back><Loading /></Screen>;
  if (!q.data) return <Screen title="Credit note" back><ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} /></Screen>;
  const inv = q.data.invoices.find((r) => r.id === param(params.invoiceId));
  if (!inv) return <Screen title="Credit note" back><EmptyState icon="receipt" title="Invoice not found" /></Screen>;
  return <Form inv={inv} companyState={q.data.company.gstin.slice(0, 2)} />;
}

function Form({ inv, companyState }: { inv: InvoiceRow; companyState: string }) {
  const issue = useAction("invoices.issueCreditNote");
  const [fees, setFees] = useState(paiseToInput(inv.creditablePaise));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const feesPaise = parseRupeesToPaise(fees) ?? 0;
  const gst = computeGst(feesPaise, inv.gstin && inv.gstin !== "—" ? inv.gstin.slice(0, 2) : null, companyState);

  async function save() {
    const res = await runAction(issue, { invoiceId: inv.id, feesPaise, reason });
    if (res.ok) router.back();
    else setErrors(fieldErrors(res));
  }

  return (
    <FormScreen title="Credit note" sub={`Against ${inv.number} · up to ${formatINR(inv.creditablePaise)} in fees`} onSubmit={save} saving={issue.isPending} submitLabel="Issue credit note">
      <AmountField label="Fees to credit (excl. GST)" value={fees} onChange={setFees} error={errors.feesPaise} />
      <Card style={{ marginTop: 14, paddingVertical: 4 }}>
        <KeyValue first k="GST" v={formatINR(gst.gstPaise)} />
        <KeyValue k="Total credit" v={formatINR(gst.totalPaise)} />
      </Card>
      <Field label="Reason" value={reason} onChangeText={setReason} error={errors.reason} multiline placeholder="Why the invoice is being reduced" />
    </FormScreen>
  );
}
