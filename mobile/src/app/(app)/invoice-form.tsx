import { checkGstin, computeGst, gstinErrorMessage, normaliseGstin, STATE_NAMES } from "@shared/gstin";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { errorText } from "@/api/client";
import { runAction, useAction, useInvoices } from "@/api/queries";
import type { InvoicesResponse } from "@/api/types";
import { AmountField, Field, FieldError, FieldLabel, NumberField, Segmented, Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Button, Card, ErrorState, KeyValue, Loading } from "@/components/ui/primitives";
import { FormScreen, Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";
import { fieldErrors, intOrNull, param } from "@/lib/forms";
import { formatINR, parseRupeesToPaise } from "@/lib/format";
import { colors } from "@/theme/tokens";

type Kind = "INVOICE" | "PROFORMA";
interface ShareRow {
  key: number;
  who: string; // user id, or "external"
  name: string;
  pct: string;
}

/** Raise a tax invoice or a proforma (the web's document form; GST and numbering are worked out on the server). */
export default function InvoiceForm() {
  const params = useLocalSearchParams<{ kind?: string; lead?: string }>();
  const lead = param(params.lead) ?? null;
  const q = useInvoices(lead);
  const kind: Kind = param(params.kind) === "PROFORMA" ? "PROFORMA" : "INVOICE";
  if (q.isPending) return <Screen title="Invoice" back><Loading /></Screen>;
  if (!q.data) return <Screen title="Invoice" back><ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} /></Screen>;
  return <Form data={q.data} kind={kind} />;
}

function Form({ data, kind }: { data: InvoicesResponse; kind: Kind }) {
  const raise = useAction("invoices.raise");
  const proforma = useAction("invoices.createProforma");
  const p = data.prefill;
  const [payeeName, setPayeeName] = useState(p?.payeeName ?? "");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [narration, setNarration] = useState(p?.narration ?? "");
  const [terms, setTerms] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [fees, setFees] = useState(p?.feesRupees ?? "");
  const [validity, setValidity] = useState<"7" | "15" | "30">("15");
  const [shares, setShares] = useState<ShareRow[]>(
    (p?.brokers ?? []).map((b, i) => (b.kind === "user" ? { key: i, who: b.userId, name: "", pct: b.pct } : { key: i, who: "external", name: b.name, pct: b.pct })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const feesPaise = parseRupeesToPaise(fees) ?? 0;
  const check = gstin ? checkGstin(gstin) : null;
  const companyState = data.company.gstin.slice(0, 2);
  const gst = computeGst(feesPaise, check?.ok ? check.stateCode : null, companyState);
  const totalPct = shares.reduce((a, s) => a + (intOrNull(s.pct) ?? 0), 0);
  const people = [...data.users.map((u) => ({ value: u.id, label: u.name })), { value: "external", label: "Outside broker" }];

  async function save() {
    const input = {
      payeeName,
      billingAddress: address,
      gstin,
      narration,
      paymentTerms: terms,
      mobile,
      email,
      feesPaise,
      brokers: shares.map((s) => (s.who === "external" ? { externalName: s.name, sharePct: intOrNull(s.pct) ?? 0 } : { userId: s.who, sharePct: intOrNull(s.pct) ?? 0 })),
      leadId: p?.leadId ?? null,
    };
    const res = kind === "PROFORMA" ? await runAction(proforma, { ...input, validityDays: Number(validity) }) : await runAction(raise, input);
    if (res.ok) router.back();
    else setErrors(fieldErrors(res));
  }

  return (
    <FormScreen
      title={kind === "PROFORMA" ? "New proforma" : "New tax invoice"}
      sub={`${kind === "PROFORMA" ? data.nextProforma : data.nextInvoice}${p ? ` · ${p.leadName}` : ""}`}
      onSubmit={save}
      saving={raise.isPending || proforma.isPending}
      submitLabel={kind === "PROFORMA" ? "Create proforma" : "Raise invoice"}
    >
      <Field label="Bill to" value={payeeName} onChangeText={setPayeeName} error={errors.payeeName} autoCapitalize="words" placeholder="Company name" />
      <Field label="Billing address" value={address} onChangeText={setAddress} error={errors.billingAddress} multiline />
      <Field label="GSTIN" value={gstin} onChangeText={(t) => setGstin(normaliseGstin(t).slice(0, 15))} autoCapitalize="characters" placeholder="29AAKFP4821L1ZR" error={errors.gstin ?? (check && !check.ok && gstin.length >= 15 ? gstinErrorMessage(check.reason) : undefined)} />
      {check?.ok ? (
        <T variant="caption" style={{ marginTop: 6 }}>
          Place of supply: {STATE_NAMES[check.stateCode] ?? check.stateCode} ({check.stateCode}) · {gst.intraState ? "CGST + SGST" : "IGST"}
        </T>
      ) : null}
      <Field label="Narration" value={narration} onChangeText={setNarration} error={errors.narration} multiline placeholder="e.g. Brokerage — 12,500 sq ft at Prestige Tech Park" />
      <Field label="Payment terms" value={terms} onChangeText={setTerms} error={errors.paymentTerms} placeholder="e.g. Net 30 days from invoice date" />
      <Field label="Client mobile" value={mobile} onChangeText={setMobile} error={errors.mobile} keyboardType="phone-pad" placeholder="10-digit mobile" />
      <Field label="Client email" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoCapitalize="none" />
      <AmountField label="Fees (excl. GST)" value={fees} onChange={setFees} error={errors.feesPaise} />
      {kind === "PROFORMA" ? (
        <Segmented
          label="Valid for"
          value={validity}
          onChange={setValidity}
          options={[
            { value: "7", label: "7 days" },
            { value: "15", label: "15 days" },
            { value: "30", label: "30 days" },
          ]}
        />
      ) : null}

      <Card style={{ marginTop: 16, paddingVertical: 4 }}>
        <KeyValue first k="Fees" v={formatINR(feesPaise)} />
        {gst.intraState ? (
          <>
            <KeyValue k="CGST 9%" v={formatINR(gst.cgstPaise)} />
            <KeyValue k="SGST 9%" v={formatINR(gst.sgstPaise)} />
          </>
        ) : (
          <KeyValue k="IGST 18%" v={formatINR(gst.igstPaise)} />
        )}
        <KeyValue k="Total" v={<T variant="strong" weight="bold" align="right" style={{ flex: 1 }}>{formatINR(gst.totalPaise)}</T>} />
      </Card>

      <FieldLabel>Broker split (optional)</FieldLabel>
      {shares.map((s, i) => (
        <View key={s.key} style={styles.share}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Select value={s.who} onChange={(who) => setShares(shares.map((x, j) => (j === i ? { ...x, who } : x)))} options={people} placeholder="Broker" />
            </View>
            <Pressable onPress={() => setShares(shares.filter((_, j) => j !== i))} hitSlop={10} accessibilityLabel="Remove broker">
              <Icon name="close" color={colors.muted} />
            </Pressable>
          </View>
          {s.who === "external" ? <Field value={s.name} onChangeText={(name) => setShares(shares.map((x, j) => (j === i ? { ...x, name } : x)))} placeholder="Broker's full name" autoCapitalize="words" /> : null}
          <NumberField label="Share %" value={s.pct} onChange={(pct) => setShares(shares.map((x, j) => (j === i ? { ...x, pct } : x)))} />
        </View>
      ))}
      <Button label="Add broker" icon="userAdd" kind="ghost" size="sm" style={{ marginTop: 10, alignSelf: "flex-start" }} onPress={() => setShares([...shares, { key: Date.now(), who: data.users[0]?.id ?? "external", name: "", pct: String(Math.max(0, 100 - totalPct)) }])} />
      {shares.length ? (
        <T variant="caption" color={totalPct === 100 ? colors.success : colors.danger} style={{ marginTop: 8 }}>
          Shares total {totalPct}% {totalPct === 100 ? "" : "· must be exactly 100%"}
        </T>
      ) : null}
      <FieldError message={errors.brokers} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  share: { marginTop: 10, padding: 12, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.03)" },
});
