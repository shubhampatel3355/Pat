"use client";

import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { EXPECTED_WEIGHT, INCENTIVE_RATE, type IncentiveStatus } from "@/lib/incentive";
import { formatCompactINR, formatINR } from "@/lib/money";
import type { StatementType } from "@/lib/payroll";
import type { IncentiveSummary } from "@/server/services/incentive";
import type { PayrollEmployeeDto } from "@/server/services/payroll";
import { EmptyState } from "../ui/bits";
import { Button } from "../ui/button";
import { Page, PageHeader, SectionTitle } from "../ui/page";
import { Cell, HeadCell, Row, RowHead, RowTable } from "../ui/row-table";
import { Segmented } from "../ui/segmented";
import { useDownload } from "../ui/use-download";
import { StagePill } from "../wip/stage-pill";

const STAT = "flex flex-col gap-1.5 rounded-[20px] bg-card p-4 shadow-raised";
const PERIODS = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
] as const;
const STATUS: Record<IncentiveStatus, { label: string; className: string }> = {
  EARNED: { label: "Earned", className: "bg-[rgba(62,155,82,.18)]" },
  EXPECTED: { label: "Expected", className: "bg-primary-tint" },
  NO_PAYOUT: { label: "No payout", className: "bg-chip-2" },
};

/** Prototype "Payslips & Incentive" (Employee View): own payslips by period and incentive per deal. */
export function MyPayScreen({ me, incentive, monthLabel }: { me: PayrollEmployeeDto; incentive: IncentiveSummary; monthLabel: string }) {
  const [type, setType] = useState<StatementType>("MONTHLY");
  const file = useDownload();
  const slips = me.statements[type];

  return (
    <Page>
      <PageHeader title="Payslips & Incentive" meta={`${me.name} · ${me.title} · ${monthLabel}`} />

      <div className="pm-stagger grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2">
        {[
          ["Incentive earned", formatCompactINR(incentive.earnedPaise), "text-success-ink"],
          ["Incentive expected", formatCompactINR(incentive.expectedPaise), ""],
          ["Current CTC", me.ctcAnnualPaise === null ? "—" : formatINR(me.ctcAnnualPaise), ""],
          ["Date of joining", me.dateOfJoining ? formatDate(me.dateOfJoining) : "—", ""],
        ].map(([label, value, tone]) => (
          <div key={label} className={STAT}>
            <span className="text-xs text-muted">{label}</span>
            <span className={`text-[28px] font-light leading-9 ${tone}`}>{value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <SectionTitle title="Payslips" />
        <Segmented options={PERIODS} value={type} onChange={setType} label="Payslip period" size="sm" />
      </div>
      {slips.length ? (
        <RowTable label="Payslips" minWidth={420} columns="minmax(160px,1fr) auto">
          <RowHead>
            <HeadCell>Period</HeadCell>
            <HeadCell align="right">Payslip</HeadCell>
          </RowHead>
          {slips.map((s) => (
            <Row key={s.key}>
              <Cell>{s.label}</Cell>
              <Cell align="right">
                <Button
                  size="sm"
                  icon="download"
                  iconSize={13}
                  className="h-[34px]"
                  loading={file.pending === s.key}
                  disabled={file.pending !== null && file.pending !== s.key}
                  onClick={() => void file.download(`/api/payslips/${me.id}/${type}/${encodeURIComponent(s.key)}`, "payslip.pdf", s.key)}
                >
                  Download payslip
                </Button>
              </Cell>
            </Row>
          ))}
        </RowTable>
      ) : (
        <EmptyState className="rounded-card bg-card">No payslips yet. They appear here once a month’s payroll is disbursed.</EmptyState>
      )}

      <div className="pt-2">
        <SectionTitle title="My incentive" meta={`${incentive.fyLabel} · ${INCENTIVE_RATE * 100}% of your share of each deal’s fee · expected deals counted at ${EXPECTED_WEIGHT * 100}%`} />
      </div>
      {incentive.rows.length ? (
        <RowTable label="My incentive" minWidth={860} columns="minmax(200px,2fr) minmax(140px,1fr) 100px 80px 100px 110px">
          <RowHead>
            <HeadCell>Tenant</HeadCell>
            <HeadCell>Stage</HeadCell>
            <HeadCell align="right">Deal fee</HeadCell>
            <HeadCell align="right">My share</HeadCell>
            <HeadCell align="right">Incentive</HeadCell>
            <HeadCell>Status</HeadCell>
          </RowHead>
          {incentive.rows.map((r) => (
            <Row key={r.leadId}>
              <Cell className="flex flex-col">
                <span className="truncate">{r.tenantName}</span>
                <span className="truncate text-[11px] text-muted">{r.building}</span>
              </Cell>
              <Cell>
                <StagePill remark={r.remark} />
              </Cell>
              <Cell align="right">{formatCompactINR(r.feePaise)}</Cell>
              <Cell align="right">{Math.round(r.sharePct)}%</Cell>
              <Cell align="right" className="font-medium">
                {r.status === "NO_PAYOUT" ? "—" : formatCompactINR(r.incentivePaise)}
              </Cell>
              <Cell>
                <span className={`inline-flex h-6 items-center rounded-pill px-2.5 text-[11px] font-medium ${STATUS[r.status].className}`}>{STATUS[r.status].label}</span>
              </Cell>
            </Row>
          ))}
        </RowTable>
      ) : (
        <EmptyState className="rounded-card bg-card">No deals assigned to you yet. Incentive appears here for WIP rows where you are a broker.</EmptyState>
      )}
    </Page>
  );
}
