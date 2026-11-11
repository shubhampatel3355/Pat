import { longMonthLabel } from "@shared/payroll";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { errorText } from "@/api/client";
import { runAction, useAction, usePayroll } from "@/api/queries";
import type { PayrollEmployee, PayrollRun } from "@/api/types";
import { Statements } from "@/components/statements";
import { Avatar, Button, Card, ErrorState, Hero, KeyValue, ListCard, ListRow, Loading, Pill, Section, StatGrid } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { T } from "@/components/ui/text";
import { formatCompactINR, formatDate, formatINR } from "@/lib/format";
import { colors } from "@/theme/tokens";

const STATUS = { REVIEW: { label: "In review", color: colors.warning }, APPROVED: { label: "Approved", color: colors.navy }, DISBURSED: { label: "Disbursed", color: colors.success } } as const;

/** Payroll (the web's /payroll): the latest run, its payslips, and everyone's statements. */
export default function Payroll() {
  const q = usePayroll();
  const [person, setPerson] = useState<PayrollEmployee | null>(null);
  if (q.data && "redirect" in q.data) return <Redirect href="/payslips" />;
  const d = q.data && !("redirect" in q.data) ? q.data : null;

  return (
    <Screen title="Payroll" back query={q} sub={d?.run ? `${d.run.label} · ${STATUS[d.run.status].label}` : undefined}>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />
      ) : d ? (
        <>
          {d.run ? <RunCard run={d.run} canRun={d.canRun} next={d.next} /> : null}
          {!d.run && d.canRun && d.next ? (
            <Card style={{ marginTop: 16 }}>
              <T variant="body">No payroll runs yet.</T>
              <Button label={`Start ${longMonthLabel(d.next.period)}`} style={{ marginTop: 12 }} onPress={() => router.push("/payroll-start")} />
            </Card>
          ) : null}
          {d.run?.payslips.length ? (
            <Section title={`Payslips · ${d.run.payslips.length}`}>
              <ListCard>
                {d.run.payslips.map((p, i) => (
                  <ListRow
                    key={p.id}
                    first={i === 0}
                    onPress={() => router.push({ pathname: "/payslip-form", params: { id: p.id } })}
                    left={<Avatar initials={p.user.initials} name={p.user.name} size={40} />}
                    title={p.user.name}
                    sub={`${p.user.title} · gross ${formatINR(p.totals.gross)}${p.components.commission ? ` · commission ${formatINR(p.components.commission)}` : ""}`}
                    right={
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <T variant="strong" weight="regular">
                          {formatINR(p.totals.net)}
                        </T>
                        {p.onHold ? <Pill label="On hold" color={colors.danger} /> : null}
                      </View>
                    }
                  />
                ))}
              </ListCard>
            </Section>
          ) : null}
          {d.employees.length ? (
            <Section title="Team on payroll">
              <ListCard>
                {d.employees.map((e, i) => (
                  <ListRow
                    key={e.id}
                    first={i === 0}
                    onPress={() => setPerson(e)}
                    left={<Avatar initials={e.initials} name={e.name} size={40} />}
                    title={e.name}
                    sub={`${e.title}${e.dateOfJoining ? ` · joined ${formatDate(e.dateOfJoining)}` : ""}`}
                    right={e.ctcAnnualPaise !== null ? <T variant="small">{formatCompactINR(e.ctcAnnualPaise)} CTC</T> : null}
                  />
                ))}
              </ListCard>
            </Section>
          ) : null}
        </>
      ) : null}
      {person ? (
        <Sheet visible onClose={() => setPerson(null)} title={person.name} sub={`${person.title}${person.ctcAnnualPaise !== null ? ` · CTC ${formatINR(person.ctcAnnualPaise)}` : ""}`}>
          <Statements person={person} />
        </Sheet>
      ) : null}
    </Screen>
  );
}

function RunCard({ run, canRun, next }: { run: PayrollRun; canRun: boolean; next: { period: string; payDate: string } | null }) {
  const recalc = useAction("payroll.recalculate");
  const approve = useAction("payroll.approve");
  const disburse = useAction("payroll.disburse");
  const status = STATUS[run.status];
  return (
    <>
      <Hero style={{ marginTop: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T variant="caption" color={colors.white} style={{ letterSpacing: 0.9, fontSize: 13 }}>
            {run.label.toUpperCase()}
          </T>
          <Pill label={status.label} color={colors.white} />
        </View>
        <T variant="display" color={colors.white} style={{ marginTop: 14 }}>
          {formatCompactINR(run.totals.net)}
        </T>
        <T variant="body" color={colors.white} style={{ marginTop: 6 }}>
          Net pay · {run.totals.live} paid{run.totals.held ? ` · ${run.totals.held} on hold` : ""} · pay date {formatDate(run.payDate)}
        </T>
      </Hero>
      <View style={{ marginTop: 12 }}>
        <StatGrid
          items={[
            { value: formatCompactINR(run.totals.commission), label: "Commission" },
            { value: formatCompactINR(run.totals.deductions), label: "Deductions" },
            { value: String(run.payslips.length), label: "Payslips" },
          ]}
        />
      </View>
      <ListCard style={{ marginTop: 12 }}>
        <KeyValue first k="Opened" v={formatDate(run.openedOn)} />
        <KeyValue k="Approved" v={run.approved ? `${formatDate(run.approved.on)} · ${run.approved.by}` : "—"} />
        <KeyValue k="Disbursed" v={run.disbursed ? `${formatDate(run.disbursed.on)} · ${run.disbursed.by}` : "—"} />
      </ListCard>
      {canRun ? (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          {run.status === "REVIEW" ? (
            <>
              <Button label="Recalculate" icon="refresh" kind="secondary" style={{ flex: 1 }} loading={recalc.isPending} onPress={() => void runAction(recalc, { id: run.id })} />
              <Button
                label="Approve"
                icon="check"
                style={{ flex: 1 }}
                loading={approve.isPending}
                onPress={() =>
                  Alert.alert(`Approve ${run.label} payroll?`, `${formatINR(run.totals.net)} net for ${run.totals.live} people. Payslips can't be edited after this.`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Approve", onPress: () => void runAction(approve, { id: run.id }) },
                  ])
                }
              />
            </>
          ) : run.status === "APPROVED" ? (
            <Button
              label="Mark disbursed"
              icon="rupee"
              style={{ flex: 1 }}
              loading={disburse.isPending}
              onPress={() =>
                Alert.alert(`Disburse ${run.label} payroll?`, "Salaries post to the ledger, and each person is told their payslip is ready.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Disburse", onPress: () => void runAction(disburse, { id: run.id }) },
                ])
              }
            />
          ) : next ? (
            <Button label={`Start ${longMonthLabel(next.period)}`} icon="plus" style={{ flex: 1 }} onPress={() => router.push("/payroll-start")} />
          ) : null}
        </View>
      ) : null}
    </>
  );
}
