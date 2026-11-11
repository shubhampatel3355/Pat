import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { errorText } from "@/api/client";
import { downloadAndShare, openStoredFile, pickDocuments, uploadDocuments } from "@/api/files";
import { runAction, useAction, useInvoices } from "@/api/queries";
import { useQueryClient } from "@tanstack/react-query";
import type { InvoiceRow } from "@/api/types";
import { useToast } from "@/components/toast";
import { Field } from "@/components/ui/form";
import { Button, Card, EmptyState, ErrorState, IconWell, KeyValue, ListCard, ListRow, Loading, Pill, Section } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { T } from "@/components/ui/text";
import { formatDate, formatINR } from "@/lib/format";
import { colors } from "@/theme/tokens";

const KIND = { INVOICE: "Tax invoice", PROFORMA: "Proforma invoice", CREDIT_NOTE: "Credit note" } as const;

/** One invoice, proforma or credit note: the document, payments, files and what can be done next. */
export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useInvoices();
  if (q.isPending) return <Screen title="Invoice" back><Loading /></Screen>;
  if (q.isError) return <Screen title="Invoice" back><ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} /></Screen>;
  const row = [...q.data.invoices, ...q.data.proformas].find((r) => r.id === id);
  if (!row) return <Screen title="Invoice" back><EmptyState icon="receipt" title="Not found" text="This document isn't in the list you can see." /></Screen>;
  return <Detail row={row} can={q.data.can} query={q} />;
}

function Detail({ row, can, query }: { row: InvoiceRow; can: { create: boolean; record: boolean; creditNote: boolean }; query: ReturnType<typeof useInvoices> }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const email = useAction("invoices.email");
  const convert = useAction("invoices.convertProforma");
  const [busy, setBusy] = useState<"pdf" | "upload" | null>(null);
  const [reversing, setReversing] = useState<InvoiceRow["payments"][number] | null>(null);
  const doc = row.doc;

  const pdf = async () => {
    setBusy("pdf");
    try {
      await downloadAndShare(`/api/invoices/${row.id}/pdf`, `${row.number.replace(/\//g, "-")}.pdf`, "application/pdf");
    } catch (e) {
      toast.show(errorText(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const attach = async () => {
    const assets = await pickDocuments();
    if (!assets.length) return;
    setBusy("upload");
    try {
      const res = await uploadDocuments({ invoiceId: row.id }, assets);
      toast.show(res.errors.length ? res.errors.join(" · ") : `${res.files.length} file${res.files.length === 1 ? "" : "s"} attached`, res.errors.length ? "error" : "ok");
      void queryClient.invalidateQueries();
    } catch (e) {
      toast.show(errorText(e), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title={row.number} sub={KIND[row.type]} back query={query}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
        <Pill label={row.status.label} color={row.status.color} />
        {row.convertedToNumber ? <T variant="caption">Converted to {row.convertedToNumber}</T> : null}
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <Button label="PDF" icon="download" kind="secondary" loading={busy === "pdf"} style={{ flex: 1 }} onPress={() => void pdf()} />
        {row.type !== "CREDIT_NOTE" ? (
          <Button
            label="Email client"
            icon="send"
            kind="secondary"
            loading={email.isPending}
            style={{ flex: 1 }}
            onPress={() =>
              Alert.alert(`Email ${row.number}?`, `The PDF goes to ${row.email}.`, [
                { text: "Cancel", style: "cancel" },
                { text: "Send", onPress: () => void runAction(email, { id: row.id }) },
              ])
            }
          />
        ) : null}
      </View>

      {row.type === "INVOICE" && (row.outstandingPaise > 0 || row.creditablePaise > 0) ? (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          {can.record && row.outstandingPaise > 0 ? <Button label="Record payment" icon="rupee" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/payment-form", params: { invoiceId: row.id } })} /> : null}
          {can.creditNote && row.creditablePaise > 0 ? <Button label="Credit note" icon="swap" kind="ghost" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/credit-note-form", params: { invoiceId: row.id } })} /> : null}
        </View>
      ) : null}
      {row.type === "PROFORMA" && row.rawStatus === "OPEN" && can.create ? (
        <Button
          label="Convert to tax invoice"
          icon="receipt"
          loading={convert.isPending}
          style={{ marginTop: 10 }}
          onPress={() =>
            Alert.alert("Convert this proforma?", "A tax invoice is issued with the next invoice number. A linked WIP row moves to Invoice Raised.", [
              { text: "Cancel", style: "cancel" },
              { text: "Convert", onPress: () => void runAction(convert, { id: row.id }) },
            ])
          }
        />
      ) : null}

      <Section title="Document">
        <ListCard>
          <KeyValue first k="Date" v={doc.date} />
          {doc.dueDate ? <KeyValue k="Due" v={doc.dueDate} /> : null}
          {doc.validUntil ? <KeyValue k="Valid until" v={doc.validUntil} /> : null}
          <KeyValue k="Bill to" v={doc.payeeName} />
          <KeyValue k="Address" v={doc.billingAddress} />
          <KeyValue k="GSTIN" v={doc.gstin} />
          <KeyValue k="Place of supply" v={doc.placeOfSupply} />
          <KeyValue k="Contact" v={doc.contact} />
          <KeyValue k="Terms" v={doc.paymentTerms} />
          <KeyValue k="Narration" v={doc.narration} />
          {doc.reference ? <KeyValue k="Reference" v={doc.reference} /> : null}
        </ListCard>
      </Section>

      <Section title="Amount">
        <ListCard>
          <KeyValue first k="Fees" v={doc.fees} />
          {doc.lines.map((l) => (
            <KeyValue key={l.label} k={l.label} v={<T variant="strong" weight={l.strong ? "bold" : "regular"} align="right" style={{ flex: 1 }}>{l.value}</T>} />
          ))}
          {row.type === "INVOICE" ? <KeyValue k="Outstanding" v={formatINR(row.outstandingPaise)} /> : null}
        </ListCard>
      </Section>

      {doc.brokers.length ? (
        <Section title="Broker split">
          <ListCard>
            {doc.brokers.map((b, i) => (
              <KeyValue key={`${b.name}-${i}`} first={i === 0} k={b.name} v={`${b.pct}%`} />
            ))}
          </ListCard>
        </Section>
      ) : null}

      {row.type === "INVOICE" ? (
        <Section title="Payments">
          {row.payments.length ? (
            <ListCard>
              {row.payments.map((p, i) => (
                <ListRow
                  key={p.id}
                  first={i === 0}
                  onPress={can.record ? () => setReversing(p) : undefined}
                  left={<IconWell name="rupee" size={36} color={colors.success} />}
                  title={formatINR(p.amountPaise)}
                  sub={`${formatDate(p.receivedOn)} · ${p.mode}${p.reference ? ` · ${p.reference}` : ""} · by ${p.recordedBy}`}
                />
              ))}
            </ListCard>
          ) : (
            <Card>
              <T variant="small">No payments recorded yet.</T>
            </Card>
          )}
        </Section>
      ) : null}

      <Section title="Files" action={can.create ? "Attach" : undefined} onAction={() => void attach()}>
        {row.files.length ? (
          <ListCard>
            {row.files.map((f, i) => (
              <ListRow key={f.id} first={i === 0} onPress={() => void openStoredFile(f.id).catch((e) => toast.show(errorText(e), "error"))} left={<IconWell name="file" size={36} />} title={f.name} sub={`${Math.max(1, Math.round(f.sizeBytes / 1024))} KB`} />
            ))}
          </ListCard>
        ) : (
          <Card>
            <T variant="small">{busy === "upload" ? "Uploading…" : "No files attached."}</T>
          </Card>
        )}
      </Section>
      {reversing ? <ReverseSheet payment={reversing} onClose={() => setReversing(null)} /> : null}
    </Screen>
  );
}

/** Payments recorded in error are reversed with a reason (the invoice and ledger are recalculated). */
function ReverseSheet({ payment, onClose }: { payment: InvoiceRow["payments"][number]; onClose: () => void }) {
  const reverse = useAction("invoices.reversePayment");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  return (
    <Sheet visible onClose={onClose} title="Reverse payment" sub={`${formatINR(payment.amountPaise)} · ${formatDate(payment.receivedOn)}`}>
      <Field label="Reason" value={reason} onChangeText={setReason} error={error} placeholder="e.g. Cheque bounced" />
      <Button
        label="Reverse payment"
        kind="danger"
        loading={reverse.isPending}
        style={{ marginTop: 16 }}
        onPress={async () => {
          const res = await runAction(reverse, { paymentId: payment.id, reason });
          if (res.ok) onClose();
          else setError(res.fieldErrors?.reason ?? res.error);
        }}
      />
    </Sheet>
  );
}
