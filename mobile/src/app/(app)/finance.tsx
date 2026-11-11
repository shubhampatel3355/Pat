import { yoyLabel } from "@shared/finance";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { errorText } from "@/api/client";
import { downloadAndShare } from "@/api/files";
import { runAction, useAction, useFinance } from "@/api/queries";
import type { FinanceResponse, LedgerRow } from "@/api/types";
import { useMe } from "@/auth/session";
import { useToast } from "@/components/toast";
import { Field } from "@/components/ui/form";
import { Bars, Button, Card, Chip, ChipRow, ErrorState, IconWell, ListCard, ListRow, Loading, Pill, Section } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { T } from "@/components/ui/text";
import { formatCompactINR, formatDate, formatINR, plural } from "@/lib/format";
import { colors } from "@/theme/tokens";

/** Finance overview for a financial year (the web's /finance: same figures, same definitions). */
export default function Finance() {
  const [fy, setFy] = useState<number | null>(null);
  const q = useFinance(fy);
  const d = q.data;
  return (
    <Screen title="Finance" back query={q} sub={d?.periodLabel}>
      {d ? (
        <ChipRow style={{ paddingHorizontal: 0, marginTop: 14 }}>
          {d.years.map((y) => (
            <Chip key={y.value} label={y.label} small active={d.fy === y.value} onPress={() => setFy(y.value)} />
          ))}
        </ChipRow>
      ) : null}
      {q.isPending ? <Loading /> : q.isError ? <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} /> : d ? <Body d={d} /> : null}
    </Screen>
  );
}

/** `neutral`: a rise isn't good news (expenses), so the year-on-year change isn't coloured. */
function Tile({ title, value, delta, sub, neutral }: { title: string; value: string; delta?: string; sub?: string; neutral?: boolean }) {
  return (
    <View style={styles.tile}>
      <T variant="caption">{title}</T>
      <T variant="h2" weight="regular" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      {delta ? <Pill label={delta} color={neutral ? colors.muted : delta.startsWith("−") ? colors.danger : colors.success} /> : null}
      {sub ? (
        <T variant="caption" numberOfLines={2}>
          {sub}
        </T>
      ) : null}
    </View>
  );
}

function Body({ d }: { d: FinanceResponse }) {
  const me = useMe();
  const toast = useToast();
  const o = d.overview;
  const r = o.receivables;
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [voiding, setVoiding] = useState<LedgerRow | null>(null);
  const canInvoices = me.perms.includes("invoices.view") || me.user.role === "OWNER";

  const exportAs = async (format: "xlsx" | "pdf") => {
    setExporting(format);
    try {
      await downloadAndShare(
        `/api/finance/export?fy=${d.fy}&format=${format}`,
        `Pat-Michaels-Finance-${o.period.fy.key}.${format}`,
        format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    } catch (e) {
      toast.show(errorText(e), "error");
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <View style={styles.grid}>
        <Tile title="Revenue" value={formatCompactINR(o.revenue.paise, 1)} delta={yoyLabel(o.revenue.paise, o.revenue.prevPaise)} />
        <Tile title="Expenses" value={formatCompactINR(o.expenses.paise, 1)} delta={yoyLabel(o.expenses.paise, o.expenses.prevPaise)} neutral />
        <Tile title="Profit" value={formatCompactINR(o.profit.paise, 1)} sub={o.profit.marginPct === null ? "No revenue yet" : `${o.profit.marginPct}% margin`} />
        <Tile title="Receivables" value={formatCompactINR(r.outstandingPaise, 1)} sub={`${plural(r.open.length, "invoice")}${r.overdueCount ? ` · ${r.overdueCount} overdue` : ""}`} />
        <Tile title="Collections" value={formatCompactINR(o.collections.paise, 1)} delta={yoyLabel(o.collections.paise, o.collections.prevPaise)} />
        <Tile title="Payroll" value={formatCompactINR(o.payroll.paise, 1)} sub={o.payroll.pctOfRevenue === null ? "—" : `${o.payroll.pctOfRevenue}% of revenue`} />
      </View>

      {d.can.record || d.can.export ? (
        <View style={styles.actions}>
          {d.can.record ? <Button label="Add entry" icon="plus" style={{ flex: 1 }} onPress={() => router.push("/ledger-form")} /> : null}
          {d.can.export ? <Button label="Excel" icon="download" kind="secondary" loading={exporting === "xlsx"} onPress={() => void exportAs("xlsx")} /> : null}
          {d.can.export ? <Button label="PDF" icon="download" kind="secondary" loading={exporting === "pdf"} onPress={() => void exportAs("pdf")} /> : null}
        </View>
      ) : null}

      <Section title="Monthly revenue">
        <Card>
          <Bars values={o.revenue.months.map((m) => m.paise)} labels={o.revenue.months.map((m) => m.label.slice(0, 1))} highlight={o.revenue.months.findIndex((m) => m.month === d.today.slice(0, 7))} />
          <T variant="caption" style={{ marginTop: 8 }}>
            {o.period.fy.label} · invoiced fees excl. GST, net of credit notes
          </T>
        </Card>
      </Section>

      <Section title="Receivables">
        <View style={styles.grid}>
          {r.ageing.map((a) => (
            <Tile key={a.label} title={a.label} value={formatCompactINR(a.paise)} sub={plural(a.count, "invoice")} />
          ))}
        </View>
        {r.open.length ? (
          <ListCard style={{ marginTop: 12 }}>
            {r.open.slice(0, 12).map((inv, i) => (
              <ListRow
                key={inv.id}
                first={i === 0}
                onPress={canInvoices ? () => router.push(`/invoice/${inv.id}`) : undefined}
                title={inv.payeeName}
                sub={`${inv.number} · ${inv.dueDate ? `due ${formatDate(inv.dueDate)}` : "no due date"}`}
                right={
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <T variant="strong" weight="regular">
                      {formatINR(inv.outstandingPaise)}
                    </T>
                    {inv.daysOverdue ? <Pill label={`${inv.daysOverdue} d overdue`} color={colors.danger} /> : <Pill label="Not due" color={colors.muted} />}
                  </View>
                }
              />
            ))}
          </ListCard>
        ) : null}
      </Section>

      {o.expenses.byCategory.length ? (
        <Section title="Expenses by category">
          <ListCard>
            {o.expenses.byCategory.map((c, i) => (
              <ListRow key={c.category} first={i === 0} left={<IconWell name="wallet" size={36} />} title={c.category} right={<T variant="strong" weight="regular">{formatINR(c.paise)}</T>} />
            ))}
          </ListCard>
        </Section>
      ) : null}

      <Section title="Recent entries">
        {d.entries.length ? (
          <ListCard>
            {d.entries.map((e, i) => (
              <ListRow
                key={e.id}
                first={i === 0}
                onPress={d.can.record && e.source === "manual" ? () => setVoiding(e) : undefined}
                left={<IconWell name={e.type === "INCOME" ? "download" : "upload"} size={36} color={e.type === "INCOME" ? colors.success : colors.danger} />}
                title={e.description}
                sub={`${formatDate(e.date)} · ${e.category}${e.party ? ` · ${e.party}` : ""} · ${e.mode}${e.source !== "manual" ? ` · from ${e.source}` : ""}`}
                right={
                  <T variant="strong" weight="regular" color={e.type === "INCOME" ? colors.success : colors.text}>
                    {e.type === "INCOME" ? "+" : "−"}
                    {formatINR(e.amountPaise).replace("₹ ", "₹")}
                  </T>
                }
              />
            ))}
          </ListCard>
        ) : (
          <Card>
            <T variant="small">No ledger entries in this period.</T>
          </Card>
        )}
      </Section>
      {voiding ? <VoidSheet entry={voiding} onClose={() => setVoiding(null)} /> : null}
    </>
  );
}

/** Manual entries are voided with a reason (never deleted); payment and payroll entries are reversed at source. */
function VoidSheet({ entry, onClose }: { entry: LedgerRow; onClose: () => void }) {
  const voidEntry = useAction("finance.voidEntry");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  return (
    <Sheet visible onClose={onClose} title="Void entry" sub={`${entry.description} · ${formatINR(entry.amountPaise)}`}>
      <T variant="small">The entry stays in the audit log; the totals no longer count it.</T>
      <Field label="Reason" value={reason} onChangeText={setReason} error={error} placeholder="Why is this entry being voided?" />
      <Button
        label="Void entry"
        kind="danger"
        loading={voidEntry.isPending}
        style={{ marginTop: 16 }}
        onPress={async () => {
          const res = await runAction(voidEntry, { id: entry.id, reason });
          if (res.ok) onClose();
          else setError(res.fieldErrors?.reason ?? res.error);
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  tile: { width: "48%", flexGrow: 1, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.cardBorder, padding: 14, gap: 6 },
  actions: { flexDirection: "row", gap: 8, marginTop: 16 },
});
