import { router } from "expo-router";
import { useState } from "react";
import { Linking, View } from "react-native";
import { errorText } from "@/api/client";
import { runAction, useAction, useTeams } from "@/api/queries";
import type { Member, TeamsResponse } from "@/api/types";
import { Avatar, Button, Card, Chip, ChipRow, EmptyState, ErrorState, KeyValue, ListCard, Loading, Pill, ProgressBar } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { T } from "@/components/ui/text";
import { formatCompactINR, formatDate, formatINR, percent, ROLE_LABELS } from "@/lib/format";
import { colors } from "@/theme/tokens";

const STATUS = { ACTIVE: { label: "Active", color: colors.success }, INVITED: { label: "Invited", color: colors.warning }, INACTIVE: { label: "Inactive", color: colors.muted } } as const;

/** Teams (the web's /teams): everyone except the partners, with this quarter's revenue against target. */
export default function Teams() {
  const q = useTeams();
  const [status, setStatus] = useState<Member["status"] | "ALL">("ACTIVE");
  const [open, setOpen] = useState<string | null>(null);
  const d = q.data;
  const members = (d?.members ?? []).filter((m) => status === "ALL" || m.status === status);
  const selected = d?.members.find((m) => m.id === open);

  return (
    <Screen title="Teams" back query={q} sub={d?.meta}>
      {d?.canManage ? <Button label="Invite a member" icon="userAdd" style={{ marginTop: 14 }} onPress={() => router.push("/member-form")} /> : null}
      <ChipRow style={{ paddingHorizontal: 0, marginTop: 14 }}>
        {(["ACTIVE", "INVITED", "INACTIVE"] as const).map((s) => (
          <Chip key={s} label={STATUS[s].label} active={status === s} onPress={() => setStatus(s)} count={d?.members.filter((m) => m.status === s).length} />
        ))}
        <Chip label="All" active={status === "ALL"} onPress={() => setStatus("ALL")} />
      </ChipRow>
      {q.isPending ? (
        <Loading />
      ) : q.isError || !d ? (
        <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />
      ) : members.length ? (
        <View style={{ gap: 12, marginTop: 16 }}>
          {members.map((m) => (
            <Card key={m.id} onPress={() => setOpen(m.id)}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Avatar initials={m.initials} name={m.name} size={46} gradient />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T variant="strong" numberOfLines={1}>
                    {m.name}
                  </T>
                  <T variant="caption" numberOfLines={1}>
                    {m.title}
                    {m.partnerName ? ` · ${m.partnerName}'s team` : ""}
                  </T>
                </View>
                <Pill label={STATUS[m.status].label} color={STATUS[m.status].color} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12, marginBottom: 6 }}>
                <T variant="caption">
                  {d.quarterShort} revenue {formatCompactINR(m.achievedPaise)}
                </T>
                <T variant="caption">{m.targetPaise ? `of ${formatCompactINR(m.targetPaise)}` : "No target"}</T>
              </View>
              <ProgressBar pct={percent(m.achievedPaise, m.targetPaise)} height={5} />
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState icon="users" title="Nobody here" />
      )}
      {selected && d ? <MemberSheet m={selected} d={d} onClose={() => setOpen(null)} /> : null}
    </Screen>
  );
}

function MemberSheet({ m, d, onClose }: { m: Member; d: TeamsResponse; onClose: () => void }) {
  const resend = useAction("team.resendInvite");
  return (
    <Sheet visible onClose={onClose} title={m.name} sub={`${m.title} · ${ROLE_LABELS[m.role]}`}>
      <ListCard>
        <KeyValue first k="Email" v={m.email} />
        <KeyValue k="Phone" v={m.phone || "—"} />
        <KeyValue k="Partner" v={m.partnerName ?? "—"} />
        <KeyValue k="Joined" v={m.dateOfJoining ? formatDate(m.dateOfJoining) : "—"} />
        {d.canSeeCtc ? <KeyValue k="Annual CTC" v={m.ctcAnnualPaise !== null ? formatINR(m.ctcAnnualPaise) : "—"} /> : null}
        <KeyValue k={`${d.quarterShort} revenue`} v={`${formatINR(m.achievedPaise)}${m.targetPaise ? ` of ${formatINR(m.targetPaise)}` : ""}`} />
      </ListCard>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        {m.phone ? <Button label="Call" icon="phone" kind="secondary" style={{ flex: 1 }} onPress={() => void Linking.openURL(`tel:+91${m.phone}`)} /> : null}
        <Button label="Email" icon="mail" kind="secondary" style={{ flex: 1 }} onPress={() => void Linking.openURL(`mailto:${m.email}`)} />
      </View>
      {m.canEdit ? (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <Button
            label="Edit"
            icon="edit"
            style={{ flex: 1 }}
            onPress={() => {
              onClose();
              router.push({ pathname: "/member-form", params: { id: m.id } });
            }}
          />
          {m.status === "INVITED" && d.canManage ? <Button label="Resend invite" icon="send" kind="ghost" style={{ flex: 1 }} loading={resend.isPending} onPress={() => void runAction(resend, { id: m.id })} /> : null}
        </View>
      ) : null}
    </Sheet>
  );
}
