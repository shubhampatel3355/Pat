import { CLOSED_REMARKS, WIP_REMARK, WIP_REMARKS } from "@shared/constants";
import { areaLabel, rateLabel, rentLine } from "@shared/wip";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { errorText } from "@/api/client";
import { runAction, useAction, useFollowUps, useWip } from "@/api/queries";
import type { WipRemark } from "@/api/prisma-enums";
import { FollowUpItem, TaskItem } from "@/components/work-items";
import { Avatar, Button, Card, EmptyState, ErrorState, KeyValue, ListCard, Loading, Pill, Section, StatGrid } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { ChoiceSheet } from "@/components/ui/sheet";
import { T } from "@/components/ui/text";
import { formatCompactINR, formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";

/** The deal journey on the prototype's progress bar: the six main stages; On Hold and Lost sit outside it. */
const JOURNEY: WipRemark[] = ["VISITS", "MEETINGS", "FOLLOW_UP_MEETINGS", "NEGOTIATIONS", "INVOICE_RAISED", "PAYMENT_COLLECTED"];

export default function LeadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const wip = useWip();
  const work = useFollowUps();
  const setRemark = useAction("wip.setRemark");
  const remove = useAction("wip.delete");
  const [stageOpen, setStageOpen] = useState(false);

  const row = wip.data?.rows.find((r) => r.id === id);
  if (wip.isPending) return <Screen title="WIP details" back><Loading /></Screen>;
  if (wip.isError) return <Screen title="WIP details" back><ErrorState message={errorText(wip.error)} onRetry={() => void wip.refetch()} /></Screen>;
  if (!row) return <Screen title="WIP details" back><EmptyState icon="building" title="Not found" text="This WIP row was removed, or you no longer have access to it." /></Screen>;

  const remark = WIP_REMARK[row.remark];
  const stageIndex = JOURNEY.indexOf(row.remark);
  const offJourney = stageIndex === -1;
  const followUps = (work.data?.followUps ?? []).filter((f) => f.lead?.id === row.id);
  const tasks = (work.data?.tasks ?? []).filter((t) => t.lead?.id === row.id);
  const area = areaLabel(row.pricingBasis, row.areaSqft, row.seats);

  return (
    <Screen
      title="WIP details"
      back
      query={{ isRefetching: wip.isRefetching || work.isRefetching, refetch: () => Promise.all([wip.refetch(), work.refetch()]) }}
      footer={
        <View style={styles.bar}>
          <Button label="Follow-up" icon="calendar" kind="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/follow-up-form", params: { leadId: row.id, contact: row.tenantName } })} />
          <Button label="Task" icon="checkCircle" kind="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/task-form", params: { leadId: row.id } })} />
          {row.canEdit ? <Button label="Edit" icon="edit" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/lead-form", params: { id: row.id } })} /> : null}
        </View>
      }
    >
      <View style={styles.identity}>
        <Avatar initials={row.initials} name={row.tenantName} size={84} />
        <T variant="h1" align="center" style={{ marginTop: 12 }}>
          {row.tenantName}
        </T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          <Pill label={remark.label} color={remark.color} />
          <T variant="caption">WIP #{row.sl}</T>
        </View>
      </View>

      <View style={{ marginTop: 20 }}>
        <StatGrid
          items={[
            { value: formatCompactINR(row.estFeesPaise), label: "Est. fees" },
            { value: rentLine(row.pricingBasis, row.monthlyRentPaise).replace(" / month", "/mo"), label: "Rent" },
            { value: formatDate(row.closureDate).replace(/ \d{4}$/, ""), label: "Closure" },
          ]}
        />
      </View>

      <Card style={{ marginTop: 14 }}>
        <View style={styles.journeyHead}>
          <T variant="h3">Deal journey</T>
          {row.canEdit ? <Button label="Change stage" kind="ghost" size="sm" onPress={() => setStageOpen(true)} /> : null}
        </View>
        <T variant="small" style={{ marginTop: 4 }}>
          {offJourney ? `${remark.label} · outside the pipeline` : `Stage ${stageIndex + 1} of ${JOURNEY.length} · ${remark.label}`}
        </T>
        <View style={styles.segments}>
          {JOURNEY.map((r, i) => (
            <View key={r} style={[styles.segment, { backgroundColor: !offJourney && i < stageIndex ? colors.navy : !offJourney && i === stageIndex ? colors.steel : "rgba(0,0,0,0.1)" }]} />
          ))}
        </View>
        <View style={styles.journeyFoot}>
          <T variant="caption">Visits</T>
          <T variant="caption">{!offJourney && stageIndex < JOURNEY.length - 1 ? `Next: ${WIP_REMARK[JOURNEY[stageIndex + 1]!].label}` : row.remark === "PAYMENT_COLLECTED" ? "Closed won" : ""}</T>
          <T variant="caption">Paid</T>
        </View>
      </Card>

      <Section title="Details">
        <ListCard>
          <KeyValue first k="Building" v={row.building || "—"} />
          <KeyValue k="Location" v={row.location} />
          <KeyValue k={row.landlordType === "OPERATOR" ? "Operator" : "Landlord"} v={row.landlordName || "—"} />
          <KeyValue k="Rate" v={rateLabel(row.pricingBasis, row.ratePaise)} />
          {area !== "—" ? <KeyValue k={row.pricingBasis === "PER_SEAT" ? "Seats" : "Area"} v={area} /> : null}
          <KeyValue k="Monthly rent" v={rentLine(row.pricingBasis, row.monthlyRentPaise)} />
          <KeyValue k="Closure date" v={formatDate(row.closureDate)} />
        </ListCard>
      </Section>

      <Section title="Brokers">
        <ListCard>
          <KeyValue first k="Primary" v={row.primary.map((b) => b.name).join(", ") || "—"} />
          <KeyValue k="Secondary" v={row.secondary.map((b) => b.name).join(", ") || "—"} />
        </ListCard>
      </Section>

      <Section title="Follow-ups" action="Schedule" onAction={() => router.push({ pathname: "/follow-up-form", params: { leadId: row.id, contact: row.tenantName } })}>
        {followUps.length && work.data ? (
          <ListCard>
            {followUps.map((f, i) => (
              <FollowUpItem key={f.id} f={f} now={work.data.now} today={work.data.today} first={i === 0} showLead={false} />
            ))}
          </ListCard>
        ) : (
          <Card>
            <T variant="small">Nothing scheduled. Set a follow-up so this mandate is not missed.</T>
          </Card>
        )}
      </Section>

      <Section title="Tasks" action="Add" onAction={() => router.push({ pathname: "/task-form", params: { leadId: row.id } })}>
        {tasks.length && work.data ? (
          <ListCard>
            {tasks.map((t, i) => (
              <TaskItem key={t.id} t={t} now={work.data.now} today={work.data.today} first={i === 0} />
            ))}
          </ListCard>
        ) : (
          <Card>
            <T variant="small">No tasks linked to this mandate.</T>
          </Card>
        )}
      </Section>

      {wip.data?.canInvoice && !CLOSED_REMARKS.includes(row.remark) ? (
        <Section title="Billing">
          <View style={{ gap: 10 }}>
            <Button label="Raise invoice" icon="receipt" onPress={() => router.push({ pathname: "/invoice-form", params: { kind: "INVOICE", lead: row.id } })} />
            <Button label="Create proforma" icon="file" kind="secondary" onPress={() => router.push({ pathname: "/invoice-form", params: { kind: "PROFORMA", lead: row.id } })} />
          </View>
        </Section>
      ) : null}

      {row.canDelete ? (
        <Button
          label="Remove from WIP"
          icon="trash"
          kind="ghost"
          style={{ marginTop: 26 }}
          onPress={() =>
            Alert.alert(`Remove ${row.tenantName}?`, "The row leaves WIP for everyone. The audit log keeps a record.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Remove",
                style: "destructive",
                onPress: async () => {
                  const res = await runAction(remove, { id: row.id });
                  if (res.ok) router.back();
                },
              },
            ])
          }
        />
      ) : null}

      <ChoiceSheet<WipRemark>
        visible={stageOpen}
        onClose={() => setStageOpen(false)}
        title="Move to stage"
        sub={row.tenantName}
        value={row.remark}
        options={WIP_REMARKS.map((r) => ({ value: r.value, label: r.label, color: r.color }))}
        onSelect={(value) => {
          if (value !== row.remark) void runAction(setRemark, { id: row.id, remark: value });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: "center", marginTop: 12 },
  journeyHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  segments: { flexDirection: "row", gap: 5, marginTop: 14 },
  segment: { flex: 1, height: 7, borderRadius: 4 },
  journeyFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  bar: { flexDirection: "row", gap: 8 },
});
