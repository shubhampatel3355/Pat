import { WIP_REMARK } from "@shared/constants";
import { Redirect, router } from "expo-router";
import { View } from "react-native";
import { errorText } from "@/api/client";
import { usePayslips } from "@/api/queries";
import { Statements } from "@/components/statements";
import { Card, ErrorState, Hero, KeyValue, ListCard, ListRow, Loading, Pill, Section } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";
import { formatDate, formatINR } from "@/lib/format";
import { colors } from "@/theme/tokens";

const STATUS = { EARNED: { label: "Earned", color: colors.success }, EXPECTED: { label: "Expected", color: colors.warning }, NO_PAYOUT: { label: "No payout", color: colors.muted } } as const;

/** Payslips & Incentive (the web's Employee View /payslips). */
export default function Payslips() {
  const q = usePayslips();
  if (q.data && "redirect" in q.data) return <Redirect href="/payroll" />;
  const d = q.data && !("redirect" in q.data) ? q.data : null;
  return (
    <Screen title="Payslips & Incentive" back query={q} sub={d ? `${d.incentive.fyLabel} · ${d.monthLabel}` : undefined}>
      {q.isPending ? (
        <Loading />
      ) : q.isError || !d ? (
        <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <Hero style={{ marginTop: 16 }}>
            <T variant="caption" color={colors.white} style={{ letterSpacing: 0.9, fontSize: 13 }}>
              INCENTIVE · {d.incentive.fyLabel.toUpperCase()}
            </T>
            <T variant="display" color={colors.white} style={{ marginTop: 14 }}>
              {formatINR(d.incentive.earnedPaise)}
            </T>
            <T variant="body" color={colors.white} style={{ marginTop: 6 }}>
              earned · {formatINR(d.incentive.expectedPaise)} more expected
            </T>
          </Hero>
          <ListCard style={{ marginTop: 14 }}>
            <KeyValue first k="Annual CTC" v={d.me.ctcAnnualPaise !== null ? formatINR(d.me.ctcAnnualPaise) : "—"} />
            <KeyValue k="Joined" v={d.me.dateOfJoining ? formatDate(d.me.dateOfJoining) : "—"} />
          </ListCard>
          <Section title="Payslips">
            <Statements person={d.me} />
          </Section>
          <Section title="Incentive by deal">
            {d.incentive.rows.length ? (
              <ListCard>
                {d.incentive.rows.map((r, i) => (
                  <ListRow
                    key={r.leadId}
                    first={i === 0}
                    onPress={() => router.push(`/lead/${r.leadId}`)}
                    title={r.tenantName}
                    sub={`${WIP_REMARK[r.remark].label} · ${Math.round(r.sharePct)}% of ${formatINR(r.feePaise)}`}
                    right={
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <T variant="strong" weight="regular">
                          {formatINR(r.incentivePaise)}
                        </T>
                        <Pill label={STATUS[r.status].label} color={STATUS[r.status].color} />
                      </View>
                    }
                  />
                ))}
              </ListCard>
            ) : (
              <Card>
                <T variant="small">No deals this financial year yet.</T>
              </Card>
            )}
            <T variant="caption" style={{ marginTop: 10 }}>
              20% of your share of each deal's fee. Invoiced and collected deals count as earned; deals in play count at half.
            </T>
          </Section>
        </>
      )}
    </Screen>
  );
}
