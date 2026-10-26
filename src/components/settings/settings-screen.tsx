"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/generated/prisma/enums";
import { formatDateTimeShort } from "@/lib/dates";
import { formatCompactINR, paiseToInput, parseRupeesToPaise } from "@/lib/money";
import { saveTargetsAction, setPermissionAction } from "@/server/actions/settings";
import type { AuditRowDto, InfoRow, IntegrationCard, RolesMatrix, TargetsView } from "@/server/services/settings";
import { Avatar, EmptyState, StatusPill, Toggle } from "../ui/bits";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Icon } from "../ui/icon";
import { Page, PageHeader } from "../ui/page";
import { useAction } from "../ui/toast";

export type SettingsTab = "general" | "roles" | "integrations" | "audit";

const TAB_LABELS: Record<SettingsTab, string> = { general: "General", roles: "Roles & permissions", integrations: "Integrations", audit: "Audit log" };
const PANEL = "flex flex-col gap-1.5 rounded-[20px] bg-card p-4 shadow-raised";
const MODULE_COLOR: Record<string, string> = {
  WIP: "#023E7D",
  "Business Development": "#F2994A",
  Finance: "#3E9B52",
  Invoices: "#3E9B52",
  Payroll: "#9C9CA3",
  Tasks: "#E8B84A",
  Vehicles: "#F5B73B",
  Vault: "#5C7FA8",
  Teams: "#002855",
  Settings: "#6B6B70",
  Auth: "#A8A8AD",
  Dashboard: "#A8A8AD",
};
const STATUS_COLOR: Record<IntegrationCard["status"], string> = { Connected: "#3E9B52", Development: "#F5B73B", Off: "#A8A8AD", "Not configured": "#A8A8AD", "Coming soon": "#5C7FA8" };

export function SettingsScreen({ tab, tabs, children }: { tab: SettingsTab; tabs: SettingsTab[]; children: React.ReactNode }) {
  return (
    <Page>
      <PageHeader title="Settings" meta="Company, roles, integrations and the audit trail" />
      <nav aria-label="Settings sections" className="pm-scroll relative flex max-w-full gap-0.5 self-start overflow-x-auto rounded-pill bg-card p-1">
        {tabs.map((t) => (
          <Link
            key={t}
            href={`/settings?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={cn("hit-44 flex h-8 items-center whitespace-nowrap rounded-pill px-3.5 text-[13px] font-medium", t === tab ? "bg-surface text-ink shadow-seg hover:text-ink" : "text-muted hover:text-ink")}
          >
            {TAB_LABELS[t]}
          </Link>
        ))}
      </nav>
      {children}
    </Page>
  );
}

function InfoPanel({ title, note, rows }: { title: string; note: string; rows: InfoRow[] }) {
  return (
    <section className={PANEL} aria-label={title}>
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-sm font-medium">{title}</h2>
        <span className="text-[11px] text-muted">{note}</span>
      </span>
      {rows.map((r) => (
        <div key={r.k} className="flex min-h-11 items-center justify-between gap-3 rounded-[14px] bg-surface px-3 py-1.5 text-[13px]">
          <span className="text-muted">{r.k}</span>
          <span className="text-right">{r.v}</span>
        </div>
      ))}
    </section>
  );
}

export function GeneralTab({ company, preferences, targets, canEditTargets }: { company: InfoRow[]; preferences: InfoRow[]; targets: TargetsView | null; canEditTargets: boolean }) {
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-start gap-2">
        <InfoPanel title="Company" note="From the server configuration" rows={company} />
        <InfoPanel title="Preferences" note="Fixed for Indian operations" rows={preferences} />
      </div>
      {targets && <TargetsEditor key={`${targets.fy.startYear}-${targets.quarter}`} targets={targets} canEdit={canEditTargets} />}
    </>
  );
}

function MoneyCell({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  const paise = parseRupeesToPaise(value);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="sr-only">{label}</span>
      <span className="flex h-10 items-center gap-1.5 rounded-[12px] bg-raised px-3 shadow-inset focus-within:shadow-focus">
        <span className="text-sm text-muted">₹</span>
        <input aria-label={label} inputMode="decimal" value={value} disabled={disabled} placeholder="Not set" onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ""))} className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none disabled:text-muted" />
      </span>
      <span className="h-4 text-[11px] text-muted">{paise ? formatCompactINR(paise) : ""}</span>
    </label>
  );
}

function TargetsEditor({ targets, canEdit }: { targets: TargetsView; canEdit: boolean }) {
  const router = useRouter();
  const input = (p: number | null) => (p === null ? "" : paiseToInput(p));
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = { "COMPANY:company:REVENUE": input(targets.company.revenue), "COMPANY:company:WIP_FEES": input(targets.company.wipFees) };
    for (const p of targets.partners) v[`PARTNER:${p.id}:REVENUE`] = input(p.revenue);
    for (const m of targets.members) {
      v[`USER:${m.id}:REVENUE`] = input(m.revenue);
      v[`USER:${m.id}:WIP_FEES`] = input(m.wipFees);
    }
    return v;
  });
  const save = useAction(saveTargetsAction);
  const set = (key: string) => (v: string) => setValues((s) => ({ ...s, [key]: v }));
  const go = (fy: number, q: number) => router.push(`/settings?tab=general&fy=${fy}&q=${q}`, { scroll: false });
  const submit = () =>
    void save.run({
      fy: targets.fy.startYear,
      quarter: targets.quarter,
      entries: Object.entries(values).map(([k, v]) => {
        const [scope, scopeKey, metric] = k.split(":") as ["COMPANY" | "PARTNER" | "USER", string, "REVENUE" | "WIP_FEES"];
        return { scope, scopeKey, metric, amountPaise: v.trim() ? (parseRupeesToPaise(v) ?? 0) : null };
      }),
    });

  return (
    <section className={PANEL} aria-label="Targets">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-col">
          <h2 className="m-0 text-sm font-medium">Targets</h2>
          <span className="text-[11px] text-muted">Drive the Dashboard target card, WIP cards and the Teams rings</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <select aria-label="Financial year" value={targets.fy.startYear} onChange={(e) => go(Number(e.target.value), targets.quarter)} className="hit-44 h-8 cursor-pointer rounded-pill border-0 bg-surface px-3 text-xs outline-none focus:shadow-focus">
            {targets.fyOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span role="tablist" aria-label="Quarter" className="flex gap-0.5 rounded-pill bg-surface p-0.5">
            {[1, 2, 3, 4].map((q) => (
              <button key={q} type="button" role="tab" aria-selected={q === targets.quarter} onClick={() => go(targets.fy.startYear, q)} className={cn("hit-44 h-7 rounded-pill border-0 px-3 text-xs font-medium", q === targets.quarter ? "bg-raised text-ink shadow-seg" : "bg-transparent text-muted")}>
                Q{q}
              </button>
            ))}
          </span>
          {canEdit && (
            <Button size="sm" loading={save.pending} onClick={submit}>
              Save targets
            </Button>
          )}
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-2 rounded-[14px] bg-surface p-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Company revenue · {targets.fy.label}</span>
          <MoneyCell label={`Company revenue target ${targets.fy.label}`} value={values["COMPANY:company:REVENUE"]!} onChange={set("COMPANY:company:REVENUE")} disabled={!canEdit} />
        </div>
        {targets.partners.map((p) => (
          <div key={p.id} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">
              {p.name} · {targets.fy.label}
            </span>
            <MoneyCell label={`${p.name} revenue target`} value={values[`PARTNER:${p.id}:REVENUE`]!} onChange={set(`PARTNER:${p.id}:REVENUE`)} disabled={!canEdit} />
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Company WIP fees · {targets.quarterLabel}</span>
          <MoneyCell label={`Company WIP fees target ${targets.quarterLabel}`} value={values["COMPANY:company:WIP_FEES"]!} onChange={set("COMPANY:company:WIP_FEES")} disabled={!canEdit} />
        </div>
      </div>

      <div className="pm-scroll relative overflow-x-auto">
        <div role="table" aria-label={`Member targets ${targets.quarterLabel}`} className="flex min-w-[640px] flex-col gap-1">
          <div role="row" className="grid h-9 grid-cols-[minmax(200px,1.4fr)_minmax(160px,1fr)_minmax(160px,1fr)] items-center gap-3 px-3 text-xs font-medium text-muted">
            <span role="columnheader">Member · {targets.quarterLabel}</span>
            <span role="columnheader">Revenue target</span>
            <span role="columnheader">WIP fees target</span>
          </div>
          {targets.members.map((m) => (
            <div key={m.id} role="row" className="grid grid-cols-[minmax(200px,1.4fr)_minmax(160px,1fr)_minmax(160px,1fr)] items-start gap-3 rounded-[14px] bg-surface px-3 pt-2">
              <span role="cell" className="flex items-center gap-2.5 pt-1">
                <Avatar initials={m.initials} size={28} ring={false} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px]">{m.name}</span>
                  <span className="truncate text-[11px] text-muted">{m.title}</span>
                </span>
              </span>
              <span role="cell">
                <MoneyCell label={`${m.name} revenue target`} value={values[`USER:${m.id}:REVENUE`]!} onChange={set(`USER:${m.id}:REVENUE`)} disabled={!canEdit} />
              </span>
              <span role="cell">
                <MoneyCell label={`${m.name} WIP fees target`} value={values[`USER:${m.id}:WIP_FEES`]!} onChange={set(`USER:${m.id}:WIP_FEES`)} disabled={!canEdit} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RolesTab({ matrix, canEdit }: { matrix: RolesMatrix; canEdit: boolean }) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [seen, setSeen] = useState(matrix);
  if (seen !== matrix) {
    setSeen(matrix);
    setOverrides({});
  }
  const toggle = useAction(setPermissionAction, { onError: () => setOverrides({}) });
  const flip = (role: Exclude<Role, "OWNER">, key: string, next: boolean) => {
    setOverrides((o) => ({ ...o, [`${role}:${key}`]: next }));
    void toggle.run({ role, key, allowed: next });
  };
  const cols = "minmax(220px,1.6fr) repeat(3,minmax(110px,1fr))";
  return (
    <>
      {!canEdit && (
        <p className="m-0 flex items-center gap-1.5 text-xs text-muted">
          <Icon name="lock" size={12} /> Only owners can change what each role may do.
        </p>
      )}
      <div className="pm-scroll relative overflow-x-auto rounded-card bg-card p-2">
        <div role="table" aria-label="Roles and permissions" className="flex min-w-[720px] flex-col gap-1">
          <div role="row" className="grid h-11 items-center gap-2 px-3 text-xs font-medium text-muted" style={{ gridTemplateColumns: cols }}>
            <span role="columnheader">Permission</span>
            {matrix.roles.map((r) => (
              <span key={r.role} role="columnheader" className="flex flex-col text-center">
                <span className="text-ink">{r.label}</span>
                <span className="font-normal">
                  {r.users} user{r.users === 1 ? "" : "s"}
                </span>
              </span>
            ))}
          </div>
          {matrix.groups.map((g) => (
            <div key={g.group} role="rowgroup" className="flex flex-col gap-1">
              <span className="px-3 pb-0.5 pt-2 text-[11px] font-medium uppercase tracking-[.08em] text-muted">{g.group}</span>
              {g.rows.map((p) => (
                <div key={p.key} role="row" className="grid min-h-[52px] items-center gap-2 rounded-row bg-surface px-3 text-[13px]" style={{ gridTemplateColumns: cols }}>
                  <span role="rowheader" className="flex flex-col">
                    {p.label}
                    <span className="text-[11px] text-muted">{p.description}</span>
                  </span>
                  <span role="cell" className="justify-self-center" title="Owners always have every permission">
                    <Toggle label={`${p.label} for owners`} checked disabled onChange={() => {}} />
                  </span>
                  {(["ADMIN", "EMPLOYEE"] as const).map((role) => {
                    const checked = overrides[`${role}:${p.key}`] ?? (role === "ADMIN" ? p.admin : p.employee);
                    return (
                      <span key={role} role="cell" className="justify-self-center" title={canEdit ? undefined : "Only owners can change roles"}>
                        <Toggle label={`${p.label} for ${role === "ADMIN" ? "admins" : "employees"}`} checked={checked} disabled={!canEdit} onChange={(next) => flip(role, p.key, next)} />
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function IntegrationsTab({ cards }: { cards: IntegrationCard[] }) {
  return (
    <>
      <p className="m-0 text-xs text-muted">Integrations are switched on in the server configuration and take effect after a redeploy.</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-2">
        {cards.map((c) => (
          <section key={c.name} aria-label={c.name} className="flex flex-col gap-3 rounded-[20px] bg-card p-4 shadow-raised">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] bg-surface text-xs font-medium">{c.mono}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-[11px] text-muted">{c.kind}</span>
              </span>
            </div>
            <span className="text-xs leading-4 text-muted">{c.description}</span>
            <span className="flex flex-wrap items-center gap-2">
              <StatusPill color={STATUS_COLOR[c.status]} className="h-[22px] text-[10px]">
                {c.status}
              </StatusPill>
              <span className="text-[11px] text-muted">{c.detail}</span>
            </span>
          </section>
        ))}
      </div>
    </>
  );
}

export function AuditTab({ modules, module, rows, next }: { modules: readonly string[]; module: string | null; rows: AuditRowDto[]; next: string | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const href = (m: string | null, before?: string) => `/settings?tab=audit${m ? `&module=${encodeURIComponent(m)}` : ""}${before ? `&before=${encodeURIComponent(before)}` : ""}`;
  return (
    <>
      <nav aria-label="Filter by module" className="flex flex-wrap gap-1.5">
        {[null, ...modules].map((m) => {
          const active = (m ?? null) === module;
          return (
            <Link key={m ?? "all"} href={href(m)} aria-current={active ? "true" : undefined} className={cn("hit-44 flex h-8 items-center rounded-pill px-3 text-xs", active ? "bg-primary text-white hover:text-white" : "bg-chip text-ink hover:bg-track hover:text-ink")}>
              {m ?? "All"}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col gap-1 rounded-card bg-card p-2" role="list" aria-label="Audit log">
        {rows.length === 0 && <EmptyState>Nothing recorded{module ? ` in ${module}` : ""} yet.</EmptyState>}
        {rows.map((a) => {
          const details = a.before !== null || a.after !== null;
          return (
            <div key={a.id} role="listitem" className="flex flex-col gap-2 rounded-row bg-surface px-3 py-1.5 text-[13px]">
              <div className="grid min-h-10 grid-cols-[32px_minmax(0,1fr)_auto_auto] items-center gap-3 max-sm:grid-cols-[32px_minmax(0,1fr)]">
                <Avatar initials={a.initials} size={28} ring={false} />
                <span className="flex min-w-0 flex-col">
                  {details ? (
                    <button type="button" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)} className="truncate border-0 bg-transparent p-0 text-left text-[13px] text-ink hover:text-link">
                      {a.text}
                    </button>
                  ) : (
                    <span className="truncate">{a.text}</span>
                  )}
                  <span className="text-[11px] text-muted">
                    {a.actor} · {a.action}
                    {a.ip ? ` · ${a.ip}` : ""}
                  </span>
                </span>
                <span className="max-sm:hidden">
                  <span className="flex h-[22px] items-center rounded-pill px-2.5 text-[10px] font-medium" style={{ background: `${MODULE_COLOR[a.module] ?? "#A8A8AD"}2E` }}>
                    {a.module}
                  </span>
                </span>
                <span className="text-right text-xs text-muted max-sm:hidden">{formatDateTimeShort(new Date(a.at))}</span>
              </div>
              {open === a.id && (
                <div className="grid grid-cols-1 gap-2 pb-1.5 min-[760px]:grid-cols-2">
                  {(
                    [
                      ["Before", a.before],
                      ["After", a.after],
                    ] as const
                  ).map(([label, json]) => (
                    <div key={label} className="flex min-w-0 flex-col gap-1">
                      <span className="text-[11px] font-medium text-muted">{label}</span>
                      <pre className="pm-scroll m-0 max-h-60 overflow-auto rounded-[12px] bg-raised p-2.5 text-[11px] leading-4">{json ?? "—"}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {next && (
        <Link href={href(module, next)} className="hit-44 inline-flex h-10 items-center self-center rounded-pill bg-surface px-5 text-[13px] font-medium text-ink shadow-raised hover:bg-raised hover:text-ink">
          Older entries
        </Link>
      )}
    </>
  );
}
