import { CLOSED_REMARKS, WIP_REMARKS } from "@shared/constants";
import { router } from "expo-router";
import { View } from "react-native";
import { errorText } from "@/api/client";
import { useWip } from "@/api/queries";
import { TopActions } from "@/components/top-actions";
import { Avatar, Card, EmptyState, ErrorState, ListCard, ListRow, Loading, ProgressBar, Section, StatGrid } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";
import { formatCompactINR, formatDate, percent, plural } from "@/lib/format";

/** Deal board: open mandates by stage (same stages and exclusions as the dashboard pipeline). */
export default function Pipeline() {
  const q = useWip();
  const rows = (q.data?.rows ?? []).filter((r) => !CLOSED_REMARKS.includes(r.remark));
  const total = rows.reduce((a, r) => a + r.estFeesPaise, 0);
  const stages = WIP_REMARKS.filter((s) => !CLOSED_REMARKS.includes(s.value))
    .map((s) => ({ ...s, rows: rows.filter((r) => r.remark === s.value) }))
    .filter((s) => s.rows.length);

  return (
    <Screen tabs query={q} title="Pipeline" sub={q.data ? `WIP by stage · ${plural(rows.length, "mandate")}` : undefined} right={<TopActions />}>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon="trend" title="No open mandates" text="New WIP entries appear here by stage." />
      ) : (
        <>
          <View style={{ marginTop: 16 }}>
            <StatGrid
              items={[
                { value: String(rows.length), label: "Mandates" },
                { value: String(rows.filter((r) => r.remark === "NEGOTIATIONS").length), label: "Negotiating" },
                { value: formatCompactINR(total), label: "Fees in play" },
              ]}
            />
          </View>
          <Card style={{ marginTop: 14, gap: 10 }}>
            {stages.map((s) => {
              const sum = s.rows.reduce((a, r) => a + r.estFeesPaise, 0);
              return (
                <View key={s.value}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                    <T variant="small" color={s.color === "#A8A8AD" ? undefined : s.color}>
                      {s.label} · {s.rows.length}
                    </T>
                    <T variant="small">{formatCompactINR(sum)}</T>
                  </View>
                  <ProgressBar pct={percent(sum, total)} color={s.color} height={5} />
                </View>
              );
            })}
          </Card>
          {stages.map((s) => (
            <Section key={s.value} title={`${s.label} · ${s.rows.length}`}>
              <ListCard>
                {s.rows.map((r, i) => (
                  <ListRow
                    key={r.id}
                    first={i === 0}
                    onPress={() => router.push(`/lead/${r.id}`)}
                    left={<Avatar initials={r.initials} name={r.tenantName} size={42} />}
                    title={r.tenantName}
                    sub={`${[r.building, r.location].filter(Boolean).join(", ")} · closes ${formatDate(r.closureDate)}`}
                    right={<T variant="strong" weight="regular">{formatCompactINR(r.estFeesPaise)}</T>}
                  />
                ))}
              </ListCard>
            </Section>
          ))}
        </>
      )}
    </Screen>
  );
}
