import { WIP_REMARK } from "@shared/constants";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { errorText } from "@/api/client";
import { downloadAndShare } from "@/api/files";
import { runAction, useAction, useDashboard, useLive } from "@/api/queries";
import type { DashboardData, TodoDto } from "@/api/types";
import { useMe } from "@/auth/session";
import { TopActions } from "@/components/top-actions";
import { useToast } from "@/components/toast";
import { Icon } from "@/components/ui/icon";
import { Card, Chip, ChipRow, ErrorState, Hero, IconWell, ListCard, ListRow, Loading, Pill, ProgressBar, Section } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";
import { ago, formatCompactINR, formatDate, formatINR, formatTime12, percent, relativeDayLabel } from "@/lib/format";
import { setView, useView } from "@/lib/view-store";
import { colors } from "@/theme/tokens";

/** Dashboard: the web's Company / Partner View for owners and admins, Employee View for everyone else. */
export default function Home() {
  const me = useMe();
  const view = useView();
  const q = useDashboard(view);
  const live = useLive();
  const d = q.data?.data;

  return (
    <Screen
      tabs
      query={q}
      header={
        <View style={styles.head}>
          <IconWell name="building" size={44} color={colors.white} bg={colors.navy} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T variant="caption" numberOfLines={1}>
              {d ? `${d.viewLabel} · ${q.data?.dateLabel}` : me.company.shortName}
            </T>
            <T variant="h2" weight="medium" numberOfLines={1}>
              {q.data?.greeting ?? `Hello, ${me.user.firstName}`}
            </T>
          </View>
          <TopActions />
        </View>
      }
    >
      {q.data?.view.canSwitch ? (
        <ChipRow style={{ paddingHorizontal: 0, marginTop: 16 }}>
          <Chip label="Company" active={q.data.view.value === "company"} onPress={() => setView("company")} small />
          {q.data.view.partners.map((p) => (
            <Chip key={p.id} label={p.name} active={q.data.view.value === p.id} onPress={() => setView(p.id)} small />
          ))}
        </ChipRow>
      ) : null}

      {q.isPending ? <Loading /> : q.isError ? <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} /> : d ? <Body d={d} /> : null}

      {live.data?.activity.length ? (
        <Section title="Team activity">
          <ListCard>
            {live.data.activity.slice(0, 8).map((a, i) => (
              <ListRow key={a.id} first={i === 0} left={<IconWell name="sparkles" size={36} />} title={`${a.who} ${a.text}`} numberOfLines={2} sub={`${a.module} · ${ago(a.at)}`} />
            ))}
          </ListCard>
        </Section>
      ) : null}
    </Screen>
  );
}

function Body({ d }: { d: DashboardData }) {
  return (
    <>
      <TargetHero d={d} />
      {d.employee ? <EmployeeCards d={d} /> : <CompanyCards d={d} />}
      <Todos todos={d.todos} today={d.today} />
      {d.achievements.length ? (
        <Section title="Achievements this month">
          <ListCard>
            {d.achievements.map((a, i) => (
              <ListRow
                key={a.id}
                first={i === 0}
                left={<IconWell name="trophy" size={38} color={colors.warning} bg="rgba(183,121,31,0.14)" />}
                title={a.title}
                sub={a.meta}
                right={a.valuePaise !== null ? <T variant="strong">{formatCompactINR(a.valuePaise)}</T> : null}
              />
            ))}
          </ListCard>
        </Section>
      ) : null}
    </>
  );
}

function TargetHero({ d }: { d: DashboardData }) {
  const { amountPaise, achievedPaise } = d.target;
  const pct = percent(achievedPaise, amountPaise);
  return (
    <Hero style={{ marginTop: 20 }}>
      <View style={styles.heroHead}>
        <IconWell name="target" size={40} color={colors.white} bg="rgba(255,255,255,0.16)" />
        <T variant="caption" color={colors.white} style={{ letterSpacing: 0.9, fontSize: 13 }}>
          TARGET · {d.target.label.toUpperCase()}
        </T>
      </View>
      <T variant="display" color={colors.white} style={{ marginTop: 18 }}>
        {amountPaise === null ? "Not set" : formatCompactINR(amountPaise)}
      </T>
      <T variant="body" color={colors.white} style={{ marginTop: 8 }}>
        {formatCompactINR(achievedPaise)} {d.target.note}
      </T>
      {amountPaise !== null ? (
        <>
          <View style={styles.heroRow}>
            <T variant="body" color={colors.white}>
              Progress
            </T>
            <T variant="number" color={colors.white}>
              {pct}%
            </T>
          </View>
          <ProgressBar pct={pct} height={9} color={colors.white} track="rgba(255,255,255,0.2)" />
          <View style={[styles.heroRow, { marginTop: 10 }]}>
            <T variant="caption" color={colors.white}>
              Achieved {formatCompactINR(achievedPaise)}
            </T>
            <T variant="caption" color={colors.white}>
              {achievedPaise >= amountPaise ? "Target reached" : `Remaining ${formatCompactINR(amountPaise - achievedPaise)}`}
            </T>
          </View>
        </>
      ) : (
        <T variant="small" color={colors.mist} style={{ marginTop: 12 }}>
          Targets are set in Settings → General.
        </T>
      )}
    </Hero>
  );
}

function CompanyCards({ d }: { d: DashboardData }) {
  const r = d.revenue;
  const p = d.pipeline;
  return (
    <>
      {r ? (
        <Section title="Revenue" action={d.canOpenFinance ? "Finance" : undefined} onAction={() => router.push("/finance")}>
          <Card>
            <T variant="caption">{r.ytdLabel}</T>
            <View style={styles.revenueRow}>
              <T variant="number">{formatCompactINR(r.ytdPaise)}</T>
              {r.yoyPct !== null ? <Pill label={`${r.yoyPct >= 0 ? "+" : "−"}${Math.abs(r.yoyPct)}% YoY`} color={r.yoyPct >= 0 ? colors.success : colors.danger} /> : null}
            </View>
            <T variant="small" style={{ marginTop: 6 }}>
              {r.fyLabel} · projected {formatCompactINR(r.projectedPaise)}
            </T>
            <View style={styles.prevYears}>
              {r.previous.map((y) => (
                <View key={y.key} style={{ flex: 1 }}>
                  <T variant="strong" weight="regular" numberOfLines={1}>
                    {formatCompactINR(y.valuePaise)}
                  </T>
                  <T variant="caption" numberOfLines={1}>
                    {y.label}
                  </T>
                </View>
              ))}
            </View>
          </Card>
        </Section>
      ) : null}
      {p ? (
        <Section title="Pipeline" action="View all" onAction={() => router.push("/pipeline")}>
          <Card>
            <View style={styles.revenueRow}>
              <T variant="number">{formatCompactINR(p.totalPaise)}</T>
              <T variant="small">{p.open} open mandates</T>
            </View>
            <View style={{ marginTop: 14, gap: 12 }}>
              {p.stages.map((s) => (
                <View key={s.remark}>
                  <View style={styles.stageHead}>
                    <View style={[styles.swatch, { backgroundColor: s.color }]} />
                    <T variant="small" color={colors.text} style={{ flex: 1 }}>
                      {s.label} · {s.count}
                    </T>
                    <T variant="small" color={colors.text}>
                      {formatCompactINR(s.paise)}
                    </T>
                  </View>
                  <ProgressBar pct={percent(s.paise, p.totalPaise)} color={s.color} height={5} />
                </View>
              ))}
            </View>
          </Card>
        </Section>
      ) : null}
    </>
  );
}

function EmployeeCards({ d }: { d: DashboardData }) {
  const e = d.employee!;
  const toast = useToast();
  return (
    <>
      <Section title="My WIP" action="View all" onAction={() => router.push("/wip")}>
        <Card padded={false}>
          <View style={{ padding: 16, flexDirection: "row", alignItems: "baseline", gap: 10 }}>
            <T variant="number">{formatCompactINR(e.wip.feesInPlayPaise)}</T>
            <T variant="small">fees in play · {e.wip.mandates} mandates</T>
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            {e.wip.rows.map((r, i) => (
              <ListRow
                key={r.id}
                first={i === 0}
                onPress={() => router.push(`/lead/${r.id}`)}
                title={r.tenantName}
                sub={r.building || undefined}
                right={
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <T variant="strong" weight="regular">
                      {formatCompactINR(r.feePaise)}
                    </T>
                    <Pill label={WIP_REMARK[r.remark].label} color={WIP_REMARK[r.remark].color} />
                  </View>
                }
              />
            ))}
          </View>
        </Card>
      </Section>

      {e.day.length ? (
        <Section title="My day">
          <ListCard>
            {e.day.map((item, i) => (
              <ListRow
                key={item.id}
                first={i === 0}
                onPress={() => router.push(item.kind === "CAB" ? "/vehicles" : `/lead/${item.id}`)}
                left={<IconWell name={item.kind === "CAB" ? "car" : "building"} size={38} />}
                title={item.title}
                sub={`${item.sub} · ${relativeDayLabel(item.date, d.today)}${item.time ? `, ${formatTime12(item.time)}` : ""}`}
              />
            ))}
          </ListCard>
        </Section>
      ) : null}

      <Section title="My pay" action="Details" onAction={() => router.push("/payslips")}>
        <Card>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <T variant="caption">Incentive earned</T>
              <T variant="h2" weight="regular">
                {formatINR(e.pay.earnedPaise)}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="caption">Expected</T>
              <T variant="h2" weight="regular">
                {formatINR(e.pay.expectedPaise)}
              </T>
            </View>
          </View>
          {e.pay.ctcAnnualPaise !== null || e.pay.dateOfJoining ? (
            <T variant="small" style={{ marginTop: 10 }}>
              {[e.pay.ctcAnnualPaise !== null ? `CTC ${formatCompactINR(e.pay.ctcAnnualPaise)} a year` : null, e.pay.dateOfJoining ? `Joined ${formatDate(e.pay.dateOfJoining)}` : null].filter(Boolean).join(" · ")}
            </T>
          ) : null}
          {e.pay.latestPayslip ? (
            <Pressable
              style={styles.payslip}
              accessibilityRole="button"
              onPress={() => downloadAndShare(e.pay.latestPayslip!.url, `Payslip ${e.pay.latestPayslip!.label}.pdf`, "application/pdf").catch((err) => toast.show(errorText(err), "error"))}
            >
              <Icon name="download" size={18} color={colors.navy} />
              <T variant="strong" color={colors.navy}>
                Payslip · {e.pay.latestPayslip.label}
              </T>
            </Pressable>
          ) : null}
        </Card>
      </Section>
    </>
  );
}

function Todos({ todos, today }: { todos: TodoDto[]; today: string }) {
  const update = useAction<{ id: string; patch: { done: boolean } }>("todos.update", { quiet: true });
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done).slice(0, 3);
  return (
    <Section title="My to-dos" action="Add" onAction={() => router.push("/todo-form")}>
      {todos.length ? (
        <ListCard>
          {[...open, ...done].map((t, i) => (
            <ListRow
              key={t.id}
              first={i === 0}
              onPress={() => router.push({ pathname: "/todo-form", params: { id: t.id } })}
              leftAction={
                <Pressable onPress={() => void runAction(update, { id: t.id, patch: { done: !t.done } })} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: t.done }} accessibilityLabel={t.text}>
                  <Icon name={t.done ? "checkCircle" : "circle"} size={24} color={t.done ? colors.success : colors.muted} />
                </Pressable>
              }
              title={
                <T variant="strong" style={t.done ? { textDecorationLine: "line-through", color: colors.muted } : undefined} numberOfLines={2}>
                  {t.text}
                </T>
              }
              sub={t.dueDate ? `${relativeDayLabel(t.dueDate, today)}${t.dueTime ? ` · ${formatTime12(t.dueTime)}` : ""}` : undefined}
              right={t.important ? <Icon name="star" size={16} color={colors.warning} /> : null}
            />
          ))}
        </ListCard>
      ) : (
        <Card>
          <T variant="small">Nothing on your list. Add a to-do to keep track of the small things.</T>
        </Card>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 6 },
  heroHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 22, marginBottom: 8 },
  revenueRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" },
  prevYears: { flexDirection: "row", gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(0,0,0,0.09)" },
  stageHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  payslip: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(0,0,0,0.09)" },
});
