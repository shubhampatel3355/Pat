"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { WipRemark } from "@/generated/prisma/enums";
import { CLOSED_REMARKS, tint, WIP_REMARK, WIP_REMARKS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatCompactINR } from "@/lib/money";
import { areaLabel, rateLabel, rentLine } from "@/lib/wip";
import { setRemarkAction } from "@/server/actions/wip";
import type { UserOption, WipRowDto } from "@/server/services/wip";
import { Avatar } from "../ui/bits";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { FreshValue } from "../ui/motion";
import { Page, PageHeader } from "../ui/page";
import { Cell, HeadCell, Row, RowHead, RowTable } from "../ui/row-table";
import { useAction } from "../ui/toast";
import { useDeepLink, useFreshRow } from "../ui/use-deep-link";
import { WipDrawer } from "./wip-drawer";

const COLUMNS = "56px minmax(180px,1.4fr) 150px 140px minmax(150px,1fr) 160px 130px 150px 190px 130px 190px";

function BrokerLine({ name, initials }: { name: string; initials: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar initials={initials} size={26} ring={false} />
      <span className="truncate">{name}</span>
    </div>
  );
}

export interface WipCard {
  title: string;
  icon: "target" | "trend" | "clock";
  value: string;
  tag: string;
  widthPct: number;
  sub: string;
  bg: string;
}

interface WipScreenProps {
  rows: WipRowDto[];
  cards: WipCard[];
  users: UserOption[];
  me: string;
  today: string;
  monthEnd: string;
  defaultClosure: string;
  canCreate: boolean;
  canInvoice: boolean;
}

export function WipScreen({ rows, cards, users, me, today, monthEnd, defaultClosure, canCreate, canInvoice }: WipScreenProps) {
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<WipRemark | "ALL">("ALL");
  const [drawer, setDrawer] = useState<{ open: boolean; row: WipRowDto | null }>(() => ({ open: params.get("new") === "1" && canCreate, row: null }));
  const [fresh, setFresh] = useFreshRow(params.get("focus"));
  const remark = useAction(setRemarkAction);
  useDeepLink("/wip", "wip");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "ALL" || r.remark === filter) &&
        (!q || [r.tenantName, r.building, r.location, r.landlordName, ...r.primary.map((b) => b.name), ...r.secondary.map((b) => b.name)].join(" ").toLowerCase().includes(q)),
    );
  }, [rows, query, filter]);

  return (
    <Page>
      <PageHeader
        title="WIP"
        actions={
          <>
            <div className="flex h-10 items-center gap-2 rounded-pill bg-surface px-3.5 shadow-inset">
              <Icon name="search" size={15} color="var(--color-muted)" />
              <input
                aria-label="Search WIP"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tenant, location, broker"
                className="w-[200px] border-0 bg-transparent text-[13px] outline-none max-sm:w-[140px]"
              />
            </div>
            <select
              aria-label="Filter by remark"
              value={filter}
              onChange={(e) => setFilter(e.target.value as WipRemark | "ALL")}
              className="hit-44 h-10 cursor-pointer rounded-pill border-0 bg-surface px-3.5 text-[13px] text-ink shadow-raised outline-none"
            >
              <option value="ALL">All remarks</option>
              {WIP_REMARKS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} · {rows.filter((w) => w.remark === r.value).length}
                </option>
              ))}
            </select>
            {canCreate && <Button onClick={() => setDrawer({ open: true, row: null })}>+ New Tenant / Lead</Button>}
          </>
        }
      />

      <div className="pm-stagger grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-2">
        {cards.map((c) => (
          <div key={c.title} className="flex min-h-[150px] flex-col gap-2.5 rounded-[20px] p-[18px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_10px_28px_rgba(0,18,51,.22)]" style={{ background: c.bg }}>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-white/14">
                <Icon name={c.icon} size={14} color="#fff" />
              </span>
              <span className="flex-1 text-sm font-medium">{c.title}</span>
              <span className="text-xs text-white/88">{c.tag}</span>
            </div>
            <span className="text-[32px] font-semibold leading-9 tracking-[-.02em]">
              <FreshValue value={c.value} />
            </span>
            <div className="flex-1" />
            <div className="flex flex-col gap-1.5">
              <div className="relative h-1.5 rounded-pill bg-white/18" role="progressbar" aria-valuenow={Math.round(c.widthPct)} aria-valuemin={0} aria-valuemax={100} aria-label={c.title}>
                <span className="absolute inset-y-0 left-0 rounded-pill bg-white transition-[width] duration-600 ease-spring" style={{ width: `${c.widthPct}%` }} />
              </div>
              <span className="text-xs text-white/88">{c.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <RowTable minWidth={1640} columns={COLUMNS} label="Work in progress">
        <RowHead>
          <HeadCell>Sl. No.</HeadCell>
          <HeadCell>Tenant Name</HeadCell>
          <HeadCell>Area/Seats</HeadCell>
          <HeadCell>Price/Rent</HeadCell>
          <HeadCell>Location</HeadCell>
          <HeadCell>Landlord / Operator</HeadCell>
          <HeadCell align="right">Estimated Fees</HeadCell>
          <HeadCell>Primary Broker</HeadCell>
          <HeadCell>Secondary Broker</HeadCell>
          <HeadCell>Est. Closure Date</HeadCell>
          <HeadCell>Remark</HeadCell>
        </RowHead>
        {visible.map((r) => {
          const open = !CLOSED_REMARKS.includes(r.remark);
          const past = open && r.closureDate < today;
          const soon = !past && r.closureDate <= monthEnd;
          const remarkMeta = WIP_REMARK[r.remark];
          return (
            <Row key={r.id} id={`wip-${r.id}`} highlighted={fresh === r.id}>
                <Cell className="text-muted">{r.sl}</Cell>
                <Cell className="flex items-center gap-2.5">
                  <Avatar initials={r.initials} />
                  {r.canEdit ? (
                    <button type="button" onClick={() => setDrawer({ open: true, row: r })} className="min-w-0 truncate border-0 bg-transparent p-0 text-left text-sm hover:text-link" title={`Edit ${r.tenantName}`}>
                      {r.tenantName}
                    </button>
                  ) : (
                    <span className="truncate text-sm">{r.tenantName}</span>
                  )}
                </Cell>
                <Cell>{areaLabel(r.pricingBasis, r.areaSqft, r.seats)}</Cell>
                <Cell className="flex flex-col">
                  <span>{rateLabel(r.pricingBasis, r.ratePaise)}</span>
                  <span className="text-[11px] text-muted">{rentLine(r.pricingBasis, r.monthlyRentPaise)}</span>
                </Cell>
                <Cell className="flex flex-col">
                  <span className="truncate">{r.building || "—"}</span>
                  <span className="text-[11px] text-muted">{r.location}</span>
                </Cell>
                <Cell className="flex flex-col">
                  <span className="truncate">{r.landlordName || "—"}</span>
                  <span className="text-[11px] text-muted">{r.landlordType === "LANDLORD" ? "Landlord" : "Operator"}</span>
                </Cell>
                <Cell align="right">{formatCompactINR(r.estFeesPaise)}</Cell>
                <Cell className="flex flex-col gap-1">
                  {r.primary.map((b) => (
                    <BrokerLine key={b.name} {...b} />
                  ))}
                </Cell>
                <Cell className="flex flex-col gap-1">
                  {r.secondary.length ? (
                    r.secondary.map((b) => <BrokerLine key={b.name} {...b} />)
                  ) : (
                    <div className="flex items-center gap-2">
                      <Avatar initials="—" size={26} tone="dashed" />
                      <span className="text-muted">—</span>
                    </div>
                  )}
                </Cell>
                <Cell>
                  <span
                    className="inline-flex h-6 items-center whitespace-nowrap rounded-pill px-2.5 text-[11px] font-medium"
                    style={{ background: past ? "var(--color-primary)" : soon ? "var(--color-primary-tint)" : "var(--color-chip-2)", color: past ? "#fff" : soon ? "var(--color-navy-950)" : "var(--color-muted)" }}
                  >
                    {formatDate(r.closureDate)}
                    {past ? " · overdue" : ""}
                  </span>
                </Cell>
                <Cell className="relative flex items-center">
                  <span className="pointer-events-none absolute left-3 h-[7px] w-[7px] rounded-pill" style={{ background: remarkMeta.color }} />
                  {r.canEdit ? (
                    <select
                      aria-label={`Remark for ${r.tenantName}`}
                      value={r.remark}
                      disabled={remark.pending}
                      onChange={(e) => {
                        setFresh(r.id);
                        void remark.run({ id: r.id, remark: e.target.value as WipRemark });
                      }}
                      className="h-[34px] w-full cursor-pointer appearance-none rounded-pill border-0 pl-[26px] pr-[30px] text-xs font-medium text-ink outline-none focus:shadow-focus"
                      style={{ background: tint(remarkMeta.color) }}
                    >
                      {WIP_REMARKS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="flex h-[34px] w-full items-center rounded-pill pl-[26px] text-xs font-medium" style={{ background: tint(remarkMeta.color) }}>
                      {remarkMeta.label}
                    </span>
                  )}
                  {r.canEdit && <Icon name="chevronDown" size={12} strokeWidth={2} color="var(--color-muted)" className="pointer-events-none absolute right-3" />}
                </Cell>
            </Row>
          );
        })}
        {visible.length === 0 && <div className="p-10 text-center text-[13px] text-muted">{rows.length ? "No WIP entries match." : "No WIP entries yet. Add your first tenant / lead."}</div>}
      </RowTable>

      <WipDrawer
        open={drawer.open}
        row={drawer.row}
        users={users}
        me={me}
        defaultClosure={defaultClosure}
        canInvoice={canInvoice}
        onClose={() => setDrawer({ open: false, row: null })}
        onSaved={(id) => {
          setDrawer({ open: false, row: null });
          if (id) setFresh(id);
        }}
      />
    </Page>
  );
}
