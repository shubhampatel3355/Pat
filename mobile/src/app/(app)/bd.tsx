import { MEETING_MODES, MEETING_TYPES, TEMPERATURE, TEMPERATURES } from "@shared/constants";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, TextInput, View } from "react-native";
import { errorText } from "@/api/client";
import { runAction, useAction, useBd } from "@/api/queries";
import type { LeadTemperature } from "@/api/prisma-enums";
import type { BdRow } from "@/api/types";
import { Fab } from "@/components/fab";
import { Field } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, Chip, ChipRow, EmptyState, ErrorState, KeyValue, ListCard, ListRow, Loading, Pill, StatGrid } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { T } from "@/components/ui/text";
import { formatDate, plural } from "@/lib/format";
import { colors, fonts } from "@/theme/tokens";

const typeLabel = (v: string) => MEETING_TYPES.find((t) => t.value === v)?.label ?? v;
const modeLabel = (v: string) => MEETING_MODES.find((m) => m.value === v)?.label ?? v;

/** Business Development: meetings log (the web's /business-development). */
export default function Bd() {
  const q = useBd();
  const [temp, setTemp] = useState<LeadTemperature | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<BdRow | null>(null);
  const d = q.data;

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (d?.rows ?? []).filter(
      (r) => (temp === "ALL" || r.temperature === temp) && (!needle || [r.tenantName, r.contactName, r.designation ?? "", r.primary.name, r.secondary?.name ?? ""].join(" ").toLowerCase().includes(needle)),
    );
  }, [d, temp, search]);
  const month = d?.today.slice(0, 7);

  return (
    <>
      <Screen title="Business Development" back query={q} sub={d ? `${plural(d.rows.length, "meeting")} logged` : undefined}>
        {d ? (
          <View style={{ marginTop: 16 }}>
            <StatGrid
              items={[
                { value: String(d.rows.length), label: "Meetings" },
                { value: String(d.rows.filter((r) => r.temperature === "HOT").length), label: "Hot" },
                { value: String(d.rows.filter((r) => r.date.startsWith(month ?? "")).length), label: "This month" },
              ]}
            />
          </View>
        ) : null}
        <View style={styles.search}>
          <Icon name="search" color={colors.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Tenant, contact or broker" placeholderTextColor={colors.faint} style={styles.input} accessibilityLabel="Search meetings" />
        </View>
        <ChipRow style={{ paddingHorizontal: 0, marginTop: 12 }}>
          <Chip label="All" active={temp === "ALL"} onPress={() => setTemp("ALL")} />
          {TEMPERATURES.map((t) => (
            <Chip key={t.value} label={t.label} active={temp === t.value} onPress={() => setTemp(t.value)} count={d?.rows.filter((r) => r.temperature === t.value).length} />
          ))}
        </ChipRow>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />
        ) : rows.length ? (
          <ListCard style={{ marginTop: 16 }}>
            {rows.map((r, i) => (
              <ListRow
                key={r.id}
                first={i === 0}
                onPress={() => setOpen(r)}
                left={<Avatar initials={r.primary.initials} name={r.primary.name} size={40} />}
                title={r.tenantName}
                sub={`${r.contactName}${r.designation ? `, ${r.designation}` : ""} · ${typeLabel(r.meetingType)} · ${formatDate(r.date)}`}
                right={<Pill label={TEMPERATURE[r.temperature].label} color={TEMPERATURE[r.temperature].color} />}
              />
            ))}
          </ListCard>
        ) : (
          <EmptyState icon="briefcase" title="No meetings" text="Log a meeting to start tracking prospects." />
        )}
      </Screen>
      <Fab label="Log a meeting" overTabs={false} onPress={() => router.push("/bd-form")} />
      {open ? <MeetingSheet row={d?.rows.find((r) => r.id === open.id) ?? open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function MeetingSheet({ row, onClose }: { row: BdRow; onClose: () => void }) {
  const setTemperature = useAction("bd.setTemperature");
  const setComment = useAction("bd.setComment");
  const remove = useAction("bd.delete");
  const [comments, setComments] = useState(row.comments);

  return (
    <Sheet visible onClose={onClose} title={row.tenantName} sub={`${typeLabel(row.meetingType)} · ${modeLabel(row.mode)} · ${formatDate(row.date)}`}>
      <ListCard>
        <KeyValue first k="Contact" v={`${row.contactName}${row.designation ? `, ${row.designation}` : ""}`} />
        <KeyValue k="Primary broker" v={row.primary.name} />
        <KeyValue k="Secondary broker" v={row.secondary?.name ?? "—"} />
        {row.contact ? <KeyValue k="Phone" v={row.contact.phone ?? "—"} /> : null}
        {row.contact ? <KeyValue k="Email" v={row.contact.email ?? "—"} /> : null}
      </ListCard>
      {row.contact && (row.contact.phone || row.contact.email) ? (
        <View style={styles.actions}>
          {row.contact.phone ? <Button label="Call" icon="phone" kind="secondary" style={{ flex: 1 }} onPress={() => void Linking.openURL(`tel:${row.contact!.phone!.replace(/\s/g, "")}`)} /> : null}
          {row.contact.email ? <Button label="Email" icon="mail" kind="secondary" style={{ flex: 1 }} onPress={() => void Linking.openURL(`mailto:${row.contact!.email}`)} /> : null}
        </View>
      ) : null}
      {row.canEdit ? (
        <>
          <T variant="label" style={{ marginTop: 18, marginBottom: 8 }}>
            Temperature
          </T>
          <View style={styles.temps}>
            {TEMPERATURES.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => void runAction(setTemperature, { id: row.id, temperature: t.value })}
                style={[styles.temp, { borderColor: t.color, backgroundColor: row.temperature === t.value ? t.color : "transparent" }]}
                accessibilityRole="button"
                accessibilityState={{ selected: row.temperature === t.value }}
              >
                <T variant="small" color={row.temperature === t.value ? colors.white : t.color}>
                  {t.label}
                </T>
              </Pressable>
            ))}
          </View>
          <Field label="Comments" value={comments} onChangeText={setComments} multiline />
          <View style={styles.actions}>
            <Button label="Save comment" kind="secondary" size="sm" loading={setComment.isPending} onPress={() => void runAction(setComment, { id: row.id, comments })} />
            <Button
              label="Edit meeting"
              icon="edit"
              size="sm"
              onPress={() => {
                onClose();
                router.push({ pathname: "/bd-form", params: { id: row.id } });
              }}
            />
          </View>
        </>
      ) : row.comments ? (
        <T variant="body" style={{ marginTop: 14 }}>
          {row.comments}
        </T>
      ) : null}
      {row.canDelete ? (
        <Button
          label="Delete meeting"
          icon="trash"
          kind="ghost"
          size="sm"
          style={{ marginTop: 16 }}
          onPress={() =>
            Alert.alert("Delete this meeting?", row.tenantName, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  const res = await runAction(remove, { id: row.id });
                  if (res.ok) onClose();
                },
              },
            ])
          }
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: 16, height: 48, borderRadius: 16, backgroundColor: "rgba(244,244,244,0.9)", borderWidth: 1, borderColor: colors.chipBorder, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  input: { flex: 1, height: "100%", fontFamily: fonts.medium, fontSize: 14.5, color: colors.text },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  temps: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  temp: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
