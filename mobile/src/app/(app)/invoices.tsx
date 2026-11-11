import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { errorText } from "@/api/client";
import { useInvoices } from "@/api/queries";
import { Segmented } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Button, EmptyState, ErrorState, ListCard, ListRow, Loading, Pill, StatGrid } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";
import { formatCompactINR, formatDate, formatINR } from "@/lib/format";
import { colors, fonts } from "@/theme/tokens";

/** Invoices, credit notes and proformas (the web's /invoices). */
export default function Invoices() {
  const q = useInvoices();
  const [mode, setMode] = useState<"invoices" | "proformas">("invoices");
  const [search, setSearch] = useState("");
  const d = q.data;
  const rows = useMemo(() => {
    const list = (mode === "invoices" ? d?.invoices : d?.proformas) ?? [];
    const needle = search.trim().toLowerCase();
    return needle ? list.filter((r) => `${r.number} ${r.payeeName} ${r.narration}`.toLowerCase().includes(needle)) : list;
  }, [d, mode, search]);
  const outstanding = (d?.invoices ?? []).reduce((a, r) => a + r.outstandingPaise, 0);

  return (
    <Screen title="Invoice" back query={q} sub={d ? `Next: ${d.nextInvoice} · ${d.nextProforma}` : undefined}>
      {d ? (
        <View style={{ marginTop: 16 }}>
          <StatGrid
            items={[
              { value: String(d.invoices.filter((r) => r.type === "INVOICE").length), label: "Invoices" },
              { value: formatCompactINR(outstanding), label: "Outstanding" },
              { value: String(d.invoices.filter((r) => r.status.label === "Overdue").length), label: "Overdue" },
            ]}
          />
        </View>
      ) : null}
      {d?.can.create ? (
        <View style={styles.actions}>
          <Button label="New invoice" icon="plus" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/invoice-form", params: { kind: "INVOICE" } })} />
          <Button label="Proforma" icon="plus" kind="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/invoice-form", params: { kind: "PROFORMA" } })} />
        </View>
      ) : null}
      <View style={{ marginTop: 14 }}>
        <Segmented value={mode} onChange={setMode} options={[{ value: "invoices", label: "Invoices & credit notes" }, { value: "proformas", label: "Proformas" }]} />
      </View>
      <View style={styles.search}>
        <Icon name="search" color={colors.muted} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Number, client or narration" placeholderTextColor={colors.faint} style={styles.input} accessibilityLabel="Search invoices" />
      </View>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />
      ) : rows.length ? (
        <ListCard style={{ marginTop: 14 }}>
          {rows.map((r, i) => (
            <ListRow
              key={r.id}
              first={i === 0}
              onPress={() => router.push(`/invoice/${r.id}`)}
              title={r.payeeName}
              sub={`${r.number} · ${formatDate(r.issueDate)}${r.convertedToNumber ? ` · → ${r.convertedToNumber}` : ""}`}
              right={
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <T variant="strong" weight="regular">
                    {formatINR(r.totalPaise)}
                  </T>
                  <Pill label={r.status.label} color={r.status.color} />
                </View>
              }
            />
          ))}
        </ListCard>
      ) : (
        <EmptyState icon="receipt" title={mode === "invoices" ? "No invoices yet" : "No proformas yet"} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  search: { marginTop: 12, height: 48, borderRadius: 16, backgroundColor: "rgba(244,244,244,0.9)", borderWidth: 1, borderColor: colors.chipBorder, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  input: { flex: 1, height: "100%", fontFamily: fonts.medium, fontSize: 14.5, color: colors.text },
});
