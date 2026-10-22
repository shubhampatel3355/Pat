"use client";

import Link from "next/link";
import { useState } from "react";
import { CAB_STATUS, CAR_TYPES, FOLLOW_UP_TYPES } from "@/lib/constants";
import { formatDayMonth, formatTime12, relativeDayLabel } from "@/lib/dates";
import { formatCompactINR } from "@/lib/money";
import type { DashboardData, PipelineStage } from "@/server/services/dashboard";
import { StatusPill } from "../ui/bits";
import { Icon } from "../ui/icon";
import { AchievementsButton, achievementValue, type AchievementRow } from "./achievements";
import { TeamActivityButton } from "./team-activity";
import { TodoCard } from "./todo-card";

const CARD = "flex flex-col gap-2.5 rounded-card bg-surface p-4 shadow-lifted";

function CardHeader({ icon, title, href, linkLabel }: { icon: "finance" | "pipeline" | "followups" | "car"; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-chip-2">
        <Icon name={icon} size={14} />
      </span>
      <h2 className="m-0 flex-1 text-sm font-medium">{title}</h2>
      {href && (
        <Link href={href} title={linkLabel} aria-label={linkLabel} className="hit-44 flex h-7 w-7 flex-none items-center justify-center rounded-pill bg-chip-2 text-ink hover:bg-primary hover:text-white">
          <Icon name="arrowUpRight" size={12} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}

function TargetCard({ label, amountPaise, achievedPaise }: DashboardData["target"]) {
  const pct = amountPaise ? Math.min(1, achievedPaise / amountPaise) : 0;
  return (
    <div className="bg-blue-hero relative mt-4 grid min-h-[240px] grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-end gap-6 overflow-hidden rounded-panel p-[clamp(20px,3vw,32px)] text-white shadow-blue-lg">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-pill bg-white/16">
            <Icon name="target" size={18} color="#fff" />
          </span>
          <span className="text-[13px] font-medium uppercase tracking-[.08em]">Target · {label}</span>
        </div>
        <span className="text-[clamp(56px,7vw,88px)] font-bold leading-none tracking-[-.03em]">{amountPaise === null ? "—" : formatCompactINR(amountPaise)}</span>
        <span className="text-sm text-white/88">{formatCompactINR(achievedPaise)} achieved year to date</span>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] opacity-88">Progress</span>
          <span className="text-[32px] font-light">{amountPaise ? `${Math.round(pct * 100)}%` : "—"}</span>
        </div>
        <div className="relative h-2.5 rounded-pill bg-white/18" role="progressbar" aria-label="Progress to target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
          <span className="absolute inset-y-0 left-0 rounded-pill bg-white transition-[width] duration-600 ease-spring" style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="flex justify-between text-xs opacity-88">
          <span>Achieved {formatCompactINR(achievedPaise)}</span>
          <span>{amountPaise === null ? "No target set" : `Remaining ${formatCompactINR(Math.max(0, amountPaise - achievedPaise))}`}</span>
        </div>
      </div>
    </div>
  );
}

function RevenueCard({ revenue, canOpenFinance }: { revenue: NonNullable<DashboardData["revenue"]>; canOpenFinance: boolean }) {
  const [fy, setFy] = useState("none");
  const picked = revenue.previous.find((p) => p.key === fy);
  return (
    <section className={CARD} aria-label="Total revenue">
      <CardHeader icon="finance" title="Total Revenue" href={canOpenFinance ? "/finance" : undefined} linkLabel="Open finance" />
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5 rounded-row bg-chip-2 px-3 py-2.5">
          <span className="text-[11px] text-muted">{revenue.ytdLabel}</span>
          <span className="text-2xl font-light leading-[30px]">{formatCompactINR(revenue.ytdPaise)}</span>
          <span className="text-[11px]" style={{ color: revenue.yoyPct === null ? "#55555A" : revenue.yoyPct >= 0 ? "#3E9B52" : "#C93C37" }}>
            {revenue.yoyPct === null ? "No data last year" : `${revenue.yoyPct >= 0 ? "+" : "−"}${Math.abs(revenue.yoyPct)}% YoY`}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-row bg-chip-2 px-3 py-2.5">
          <span className="text-[11px] text-muted">{revenue.fyLabel}</span>
          <span className="text-2xl font-light leading-[30px]">{formatCompactINR(revenue.projectedPaise)}</span>
          <span className="text-[11px] text-muted">projected full year</span>
        </div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] text-muted">Compare another financial year</span>
        <select value={fy} onChange={(e) => setFy(e.target.value)} className="h-10 cursor-pointer rounded-[14px] border-0 bg-field px-3 text-[13px] shadow-inset outline-none focus:shadow-focus">
          <option value="none">Select a financial year</option>
          {revenue.previous.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {picked && (
        <div className="flex items-baseline justify-between rounded-row bg-[rgba(2,62,125,.1)] px-3 py-2.5">
          <span className="text-xs text-muted">{picked.label.replace(" (last)", "")}</span>
          <span className="text-[22px] font-light">{formatCompactINR(picked.valuePaise)}</span>
        </div>
      )}
    </section>
  );
}

/** Stage bar by WIP remark (no weighted line), total open fees and open count. Not in the prototype — needs design sign-off. */
function PipelineCard({ title, pipeline }: { title: string; pipeline: DashboardData["pipeline"] }) {
  const stages = pipeline.stages.filter((s) => s.count > 0);
  return (
    <section className={CARD} aria-label={title}>
      <CardHeader icon="pipeline" title={title} href="/wip" linkLabel="Open WIP" />
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-light leading-[30px]">{formatCompactINR(pipeline.totalPaise)}</span>
        <span className="text-[11px] text-muted">
          {pipeline.open} open mandate{pipeline.open === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-pill bg-chip-2" role="img" aria-label={stages.map((s) => `${s.label} ${formatCompactINR(s.paise)}`).join(", ") || "No open mandates"}>
        {stages.map((s: PipelineStage) => (
          <span key={s.remark} className="h-full transition-[width] duration-600 ease-spring" style={{ width: `${pipeline.totalPaise ? (s.paise / pipeline.totalPaise) * 100 : 0}%`, background: s.color, minWidth: s.paise ? 4 : 0 }} />
        ))}
      </div>
      <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1.5 p-0">
        {pipeline.stages.map((s) => (
          <li key={s.remark} className="flex items-center gap-1.5 text-[11px]">
            <span className="h-2 w-2 flex-none rounded-pill" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-muted">
              {s.label} · {s.count}
            </span>
            <span>{formatCompactINR(s.paise)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FollowUpsCard({ items, today }: { items: NonNullable<DashboardData["employee"]>["followUps"]; today: string }) {
  return (
    <section className={CARD} aria-label="Today's follow-ups">
      <CardHeader icon="followups" title="Today's follow-ups" href="/follow-ups" linkLabel="Open follow-ups" />
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((f) => (
          <li key={f.id}>
            <Link href={f.href} className="flex items-center gap-2.5 rounded-xl bg-field px-2.5 py-2 text-ink hover:text-ink">
              <Icon name={f.type === "TASK" ? "check" : (FOLLOW_UP_TYPES.find((t) => t.value === f.type)?.icon ?? "phone")} size={14} />
              <span className="min-w-0 flex-1 truncate text-xs">{f.title}</span>
              {f.time && <span className="text-[11px] text-muted">{formatTime12(f.time)}</span>}
            </Link>
          </li>
        ))}
        {items.length === 0 && <li className="p-3 text-center text-xs text-muted">Nothing due today · {formatDayMonth(today)}</li>}
      </ul>
    </section>
  );
}

function CabsCard({ items, today }: { items: NonNullable<DashboardData["employee"]>["cabs"]; today: string }) {
  return (
    <section className={CARD} aria-label="Upcoming cabs">
      <CardHeader icon="car" title="Upcoming cabs" href="/vehicles" linkLabel="Open vehicle management" />
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-2.5 rounded-xl bg-field px-2.5 py-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs">
                {CAR_TYPES.find((t) => t.value === c.car)?.label} · {c.client}
              </span>
              <span className="truncate text-[11px] text-muted">
                {relativeDayLabel(c.date, today)}, {formatTime12(c.time)} · {c.pickup}
              </span>
            </span>
            <StatusPill color={CAB_STATUS[c.status].color}>{CAB_STATUS[c.status].label}</StatusPill>
          </li>
        ))}
        {items.length === 0 && <li className="p-3 text-center text-xs text-muted">No cabs booked.</li>}
      </ul>
    </section>
  );
}

export function DashboardScreen({ data, greeting, dateLabel }: { data: DashboardData; greeting: string; dateLabel: string }) {
  const partnerView = data.mode === "partner";
  const pct = data.target.amountPaise ? Math.round(Math.min(1, data.target.achievedPaise / data.target.amountPaise) * 100) : null;
  const rows: AchievementRow[] = [
    ...(pct !== null ? [{ id: "target", icon: "target" as const, title: `Reached ${pct}% of the annual target`, meta: `${formatCompactINR(data.target.achievedPaise)} of ${formatCompactINR(data.target.amountPaise!)}`, value: `${pct}%` }] : []),
    ...data.achievements.map((a) => ({ id: a.id, icon: (a.kind === "DEAL_CLOSED" ? "trophy" : "spark") as AchievementRow["icon"], title: a.title, meta: a.meta, value: achievementValue(a.valuePaise) })),
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-6 pr-[clamp(0px,3vw,48px)]" style={{ animation: "pmaIn .48s cubic-bezier(.22,1,.36,1) both" }}>
      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="relative z-[2] flex flex-col gap-3 pl-[clamp(0px,3vw,48px)] pt-9">
          <div className="flex items-center gap-2">
            <span
              className="flex h-6 items-center gap-1.5 rounded-pill px-2.5 text-[11px] font-medium"
              style={{ background: partnerView ? "rgba(2,62,125,.14)" : "#C7C7C7", color: partnerView ? "#001233" : "#55555A" }}
            >
              <span className="h-1.5 w-1.5 rounded-pill" style={{ background: partnerView ? "#001233" : "#55555A" }} />
              {data.viewLabel}
            </span>
            <span className="text-xs text-muted">{dateLabel}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="m-0 text-[44px] font-light leading-[48px] tracking-[-.02em] [text-wrap:balance]">{greeting}</h1>
            <div className="flex flex-wrap gap-2">
              <TeamActivityButton />
              <AchievementsButton rows={rows} headline={`${rows.length} achievement${rows.length === 1 ? "" : "s"} this month`} sub={pct === null ? "Keep the momentum going" : `${pct}% of the annual target reached`} />
            </div>
          </div>
          <TargetCard {...data.target} />
          <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-2">
            {data.revenue && <RevenueCard revenue={data.revenue} canOpenFinance={data.canOpenFinance} />}
            <PipelineCard title={data.mode === "employee" ? "My pipeline" : "Pipeline"} pipeline={data.pipeline} />
            {data.employee && <FollowUpsCard items={data.employee.followUps} today={data.today} />}
            {data.employee && <CabsCard items={data.employee.cabs} today={data.today} />}
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3 pb-8 pl-[clamp(0px,3vw,48px)]">
        <TodoCard todos={data.todos} today={data.today} />
      </div>
    </div>
  );
}
