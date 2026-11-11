import { useState } from "react";
import { Switch, View } from "react-native";
import { errorText } from "@/api/client";
import { runAction, useAction, useSettings } from "@/api/queries";
import type { AuditRow, SettingsResponse, SettingsTab, TargetsView } from "@/api/types";
import { AmountField, Segmented } from "@/components/ui/form";
import { Avatar, Button, Card, Chip, ChipRow, ErrorState, KeyValue, ListCard, ListRow, Loading, Pill, Section } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { T } from "@/components/ui/text";
import { ago, paiseToInput, parseRupeesToPaise } from "@/lib/format";
import { colors } from "@/theme/tokens";

const TAB_LABEL: Record<SettingsTab, string> = { general: "General", roles: "Roles", integrations: "Integrations", audit: "Audit log" };

/** Settings (the web's /settings): only the tabs this person may open. */
export default function Settings() {
  const [tab, setTab] = useState<SettingsTab | null>(null);
  const [fy, setFy] = useState<number | null>(null);
  const [quarter, setQuarter] = useState<number | null>(null);
  const q = useSettings({ tab, fy, q: quarter });
  const d = q.data;

  return (
    <Screen title="Settings" back query={q}>
      {d && d.tabs.length > 1 ? (
        <ChipRow style={{ paddingHorizontal: 0, marginTop: 14 }}>
          {d.tabs.map((t) => (
            <Chip key={t} label={TAB_LABEL[t]} active={d.tab === t} onPress={() => setTab(t)} />
          ))}
        </ChipRow>
      ) : null}
      {q.isPending ? (
        <Loading />
      ) : q.isError || !d ? (
        <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />
      ) : d.tab === "general" && d.general ? (
        <General g={d.general} onFy={setFy} onQuarter={setQuarter} />
      ) : d.tab === "roles" && d.roles ? (
        <Roles r={d.roles} />
      ) : d.tab === "integrations" && d.integrations ? (
        <Integrations cards={d.integrations.cards} />
      ) : d.tab === "audit" && d.audit ? (
        <Audit modules={d.audit.modules} />
      ) : null}
    </Screen>
  );
}

function General({ g, onFy, onQuarter }: { g: NonNullable<SettingsResponse["general"]>; onFy: (fy: number) => void; onQuarter: (q: number) => void }) {
  return (
    <>
      <Section title="Company">
        <ListCard>
          {g.company.map((r, i) => (
            <KeyValue key={r.k} first={i === 0} k={r.k} v={r.v} />
          ))}
        </ListCard>
        <T variant="caption" style={{ marginTop: 8 }}>
          Company details come from the server configuration.
        </T>
      </Section>
      <Section title="Preferences">
        <ListCard>
          {g.preferences.map((r, i) => (
            <KeyValue key={r.k} first={i === 0} k={r.k} v={r.v} />
          ))}
        </ListCard>
      </Section>
      {g.targets ? <Targets key={`${g.targets.fy.startYear}-${g.targets.quarter}`} t={g.targets} canEdit={g.canEditTargets} onFy={onFy} onQuarter={onQuarter} /> : null}
    </>
  );
}

type Draft = Record<string, string>;
const k = (scope: string, key: string, metric: string) => `${scope}:${key}:${metric}`;

/** Company revenue (yearly), company WIP fees (quarter), partner revenue (yearly), member revenue and WIP fees (quarter). */
function Targets({ t, canEdit, onFy, onQuarter }: { t: TargetsView; canEdit: boolean; onFy: (fy: number) => void; onQuarter: (q: number) => void }) {
  const save = useAction("settings.saveTargets");
  const initial: Draft = {
    [k("COMPANY", "company", "REVENUE")]: paiseToInput(t.company.revenue),
    [k("COMPANY", "company", "WIP_FEES")]: paiseToInput(t.company.wipFees),
    ...Object.fromEntries(t.partners.map((p) => [k("PARTNER", p.id, "REVENUE"), paiseToInput(p.revenue)])),
    ...Object.fromEntries(t.members.flatMap((m) => [[k("USER", m.id, "REVENUE"), paiseToInput(m.revenue)], [k("USER", m.id, "WIP_FEES"), paiseToInput(m.wipFees)]])),
  };
  const [draft, setDraft] = useState<Draft>(initial);
  const field = (key: string, label: string) => <AmountField key={key} label={label} value={draft[key] ?? ""} onChange={(v) => setDraft({ ...draft, [key]: v })} decimals={false} placeholder="Not set" />;

  const submit = () => {
    const entries = Object.entries(draft).map(([key, value]) => {
      const [scope, scopeKey, metric] = key.split(":") as ["COMPANY" | "PARTNER" | "USER", string, "REVENUE" | "WIP_FEES"];
      return { scope, scopeKey, metric, amountPaise: value.trim() ? (parseRupeesToPaise(value) ?? 0) : null };
    });
    void runAction(save, { fy: t.fy.startYear, quarter: t.quarter, entries });
  };

  return (
    <Section title="Targets">
      <ChipRow style={{ paddingHorizontal: 0 }}>
        {t.fyOptions.map((o) => (
          <Chip key={o.value} label={o.label} small active={o.value === t.fy.startYear} onPress={() => onFy(o.value)} />
        ))}
      </ChipRow>
      <View style={{ marginTop: 10 }}>
        <Segmented value={String(t.quarter)} onChange={(v) => onQuarter(Number(v))} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `Q${n}` }))} />
      </View>
      <T variant="caption" style={{ marginTop: 8 }}>
        {t.quarterLabel}
      </T>
      {canEdit ? (
        <>
          <Card style={{ marginTop: 12 }}>
            <T variant="h3">Company</T>
            {field(k("COMPANY", "company", "REVENUE"), `Revenue · ${t.fy.label}`)}
            {field(k("COMPANY", "company", "WIP_FEES"), `WIP fees · Q${t.quarter}`)}
          </Card>
          {t.partners.length ? (
            <Card style={{ marginTop: 12 }}>
              <T variant="h3">Partners · revenue for {t.fy.label}</T>
              {t.partners.map((p) => field(k("PARTNER", p.id, "REVENUE"), p.name))}
            </Card>
          ) : null}
          {t.members.map((m) => (
            <Card key={m.id} style={{ marginTop: 12 }}>
              <T variant="h3">{m.name}</T>
              <T variant="caption">{m.title}</T>
              {field(k("USER", m.id, "REVENUE"), `Revenue · Q${t.quarter}`)}
              {field(k("USER", m.id, "WIP_FEES"), `WIP fees · Q${t.quarter}`)}
            </Card>
          ))}
          <Button label="Save targets" loading={save.isPending} style={{ marginTop: 16 }} onPress={submit} />
        </>
      ) : (
        <T variant="small" style={{ marginTop: 12 }}>
          You can view targets; setting them needs the “Set targets” permission.
        </T>
      )}
    </Section>
  );
}

function Roles({ r }: { r: NonNullable<SettingsResponse["roles"]> }) {
  const toggle = useAction("settings.setPermission");
  return (
    <>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        {r.matrix.roles.map((role) => (
          <Card key={role.role} style={{ flex: 1, padding: 12 }}>
            <T variant="strong">{role.label}</T>
            <T variant="caption">{role.users} active</T>
          </Card>
        ))}
      </View>
      <T variant="small" style={{ marginTop: 12 }}>
        Owners have every permission. {r.canEdit ? "Changes apply within 30 seconds." : "Only owners can change permissions."}
      </T>
      {r.matrix.groups.map((g) => (
        <Section key={g.group} title={g.group}>
          <ListCard>
            {g.rows.map((row, i) => (
              <ListRow
                key={row.key}
                first={i === 0}
                title={row.label}
                sub={row.description}
                right={
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    {(["ADMIN", "EMPLOYEE"] as const).map((role) => (
                      <View key={role} style={{ alignItems: "center", gap: 2 }}>
                        <Switch
                          value={role === "ADMIN" ? row.admin : row.employee}
                          disabled={!r.canEdit}
                          onValueChange={(allowed) => void runAction(toggle, { role, key: row.key, allowed })}
                          trackColor={{ true: colors.navy, false: "rgba(0,0,0,0.18)" }}
                          thumbColor={colors.white}
                          accessibilityLabel={`${row.label} for ${role === "ADMIN" ? "admins" : "employees"}`}
                        />
                        <T variant="caption" style={{ fontSize: 10 }}>
                          {role === "ADMIN" ? "Admin" : "Employee"}
                        </T>
                      </View>
                    ))}
                  </View>
                }
              />
            ))}
          </ListCard>
        </Section>
      ))}
    </>
  );
}

const INTEGRATION_COLOR = { Connected: colors.success, Development: colors.warning, Off: colors.muted, "Not configured": colors.muted, "Coming soon": colors.steel } as const;

function Integrations({ cards }: { cards: NonNullable<SettingsResponse["integrations"]>["cards"] }) {
  return (
    <View style={{ gap: 12, marginTop: 16 }}>
      {cards.map((c) => (
        <Card key={c.name}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar initials={c.mono} size={42} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T variant="strong">{c.name}</T>
              <T variant="caption">{c.kind}</T>
            </View>
            <Pill label={c.status} color={INTEGRATION_COLOR[c.status]} />
          </View>
          <T variant="small" style={{ marginTop: 10 }}>
            {c.description}
          </T>
          <T variant="caption" style={{ marginTop: 6 }}>
            {c.detail}
          </T>
        </Card>
      ))}
      <T variant="caption">Integrations are configured on the server and change with a redeploy.</T>
    </View>
  );
}

function Audit({ modules }: { modules: readonly string[] }) {
  const [module, setModule] = useState<string | null>(null);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [open, setOpen] = useState<AuditRow | null>(null);
  return (
    <>
      <ChipRow style={{ paddingHorizontal: 0, marginTop: 14 }}>
        <Chip
          label="All"
          small
          active={module === null}
          onPress={() => {
            setModule(null);
            setCursors([null]);
          }}
        />
        {modules.map((m) => (
          <Chip
            key={m}
            label={m}
            small
            active={module === m}
            onPress={() => {
              setModule(m);
              setCursors([null]);
            }}
          />
        ))}
      </ChipRow>
      {cursors.map((before, i) => (
        <AuditPage key={`${module ?? "all"}-${before ?? "first"}`} module={module} before={before} last={i === cursors.length - 1} onMore={(next) => setCursors([...cursors, next])} onOpen={setOpen} />
      ))}
      {open ? (
        <Sheet visible onClose={() => setOpen(null)} title={open.text} sub={`${open.actor} · ${open.module} · ${ago(open.at)}${open.ip ? ` · ${open.ip}` : ""}`}>
          {open.before ? (
            <>
              <T variant="label">Before</T>
              <T variant="caption" style={{ fontFamily: "monospace", marginTop: 6 }}>
                {open.before}
              </T>
            </>
          ) : null}
          {open.after ? (
            <>
              <T variant="label" style={{ marginTop: 14 }}>
                After
              </T>
              <T variant="caption" style={{ fontFamily: "monospace", marginTop: 6 }}>
                {open.after}
              </T>
            </>
          ) : null}
          {!open.before && !open.after ? <T variant="small">No details recorded.</T> : null}
        </Sheet>
      ) : null}
    </>
  );
}

function AuditPage({ module, before, last, onMore, onOpen }: { module: string | null; before: string | null; last: boolean; onMore: (next: string) => void; onOpen: (row: AuditRow) => void }) {
  const q = useSettings({ tab: "audit", module, before });
  const a = q.data?.audit;
  if (q.isPending) return <Loading />;
  if (!a) return <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />;
  return (
    <>
      <ListCard style={{ marginTop: 14 }}>
        {a.rows.map((row, i) => (
          <ListRow key={row.id} first={i === 0} onPress={() => onOpen(row)} left={<Avatar initials={row.initials} name={row.actor} size={36} />} title={row.text} numberOfLines={3} sub={`${row.module} · ${row.action} · ${ago(row.at)}`} />
        ))}
        {!a.rows.length ? <ListRow first title="Nothing logged yet" /> : null}
      </ListCard>
      {last && a.next ? <Button label="Load more" kind="secondary" style={{ marginTop: 12 }} onPress={() => onMore(a.next!)} /> : null}
    </>
  );
}
