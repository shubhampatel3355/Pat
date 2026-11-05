"use client";

import { useState } from "react";
import { formatDate, formatDayMonth } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { longMonthLabel, type StatementType } from "@/lib/payroll";
import { approvePayrollAction, disbursePayrollAction, startPayrollRunAction } from "@/server/actions/payroll";
import type { PayrollEmployeeDto, RunDto } from "@/server/services/payroll";
import { Avatar, EmptyState } from "../ui/bits";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { FIELD, FormError, LABEL } from "../ui/field";
import { CheckGlyph, Icon } from "../ui/icon";
import { FreshValue, Presence } from "../ui/motion";
import { Modal } from "../ui/overlay";
import { Page, PageHeader } from "../ui/page";
import { Cell, HeadCell, Row, RowHead, RowTable } from "../ui/row-table";
import { useAction } from "../ui/toast";
import { useDownload } from "../ui/use-download";
import { PayslipReview } from "./payslip-review";

const COLUMNS = "minmax(200px,1.2fr) 130px 120px 400px";
const CARD = "flex flex-col gap-1.5 rounded-[20px] bg-card p-4 shadow-raised";
const SELECT = "hit-44 h-[34px] cursor-pointer rounded-pill border-0 bg-chip-2 px-2.5 text-xs outline-none focus:shadow-focus disabled:cursor-default disabled:opacity-60";
const PERIODS: { value: StatementType; label: string }[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
];

interface PayrollScreenProps {
  run: RunDto | null;
  next: { period: string; payDate: string } | null;
  employees: PayrollEmployeeDto[];
  manager: boolean;
  canRun: boolean;
}

export function PayrollScreen({ run, next, employees, manager, canRun }: PayrollScreenProps) {
  const [review, setReview] = useState(false);
  const [confirm, setConfirm] = useState<"approve" | "disburse" | null>(null);
  const [starting, setStarting] = useState(false);
  const approve = useAction(approvePayrollAction, { onSuccess: () => setConfirm(null) });
  const disburse = useAction(disbursePayrollAction, { onSuccess: () => setConfirm(null) });
  const step = run ? { REVIEW: 0, APPROVED: 1, DISBURSED: 2 }[run.status] : -1;

  const primary = (() => {
    if (!manager || !canRun) return null;
    if (run?.status === "REVIEW") return <Button onClick={() => setConfirm("approve")}>Approve payroll</Button>;
    if (run?.status === "APPROVED") return <Button onClick={() => setConfirm("disburse")}>Disburse via bank</Button>;
    if (next) return <Button onClick={() => setStarting(true)}>Start {longMonthLabel(next.period)} payroll</Button>;
    if (run?.status === "DISBURSED")
      return <span className="inline-flex h-10 items-center rounded-pill bg-success px-5 text-[13px] font-medium text-white shadow-[0_8px_20px_rgba(62,155,82,.32)]">Disbursed</span>;
    return null;
  })();

  return (
    <Page>
      <PageHeader
        title="Payroll"
        meta={manager ? (run ? `${run.label} · ${run.payslips.length} employee${run.payslips.length === 1 ? "" : "s"} · pay date ${formatDayMonth(run.payDate)}` : "No payroll run yet") : "Your payslips"}
        actions={
          manager && (
            <>
              {run && (
                <Button variant="surface" onClick={() => setReview(true)}>
                  Payslips
                </Button>
              )}
              {primary}
            </>
          )
        }
      />

      {manager && run && (
        <div className="pm-stagger grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-2">
          <div className="flex flex-col gap-3 rounded-[20px] bg-card px-4 pb-3 pt-4 shadow-raised">
            <span className="text-sm font-medium">{run.label} run</span>
            <div className="relative py-1">
              <span className="absolute left-[16.6%] right-[16.6%] top-[18px] h-0.5 rounded-pill bg-track" />
              <span className="absolute left-[16.6%] top-[18px] h-0.5 rounded-pill bg-[linear-gradient(90deg,light-dark(#5C7FA8,#7EA7D8),var(--color-primary))] transition-[width] duration-500" style={{ width: `${(step / 2) * 66.8}%` }} />
              <ol className="relative m-0 grid list-none grid-cols-3 p-0">
                {[
                  ["Review", `Opened ${formatDayMonth(run.openedOn)}`],
                  ["Approved", run.approved ? `${formatDayMonth(run.approved.on)} · ${run.approved.by.split(" ")[0]}` : "Partner sign-off"],
                  ["Disbursed", run.disbursed ? `Paid ${formatDayMonth(run.disbursed.on)}` : "Bank transfer"],
                ].map(([label, when], i) => {
                  const done = i < step || (i === 2 && step === 2);
                  const current = i === step && step !== 2;
                  return (
                    <li key={label} className="flex flex-col items-center gap-1.5" aria-current={i === step ? "step" : undefined}>
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-pill transition-colors duration-300"
                        style={{ background: done ? "var(--color-primary)" : current ? "var(--color-raised)" : "var(--color-surface)", border: current ? "1.5px solid var(--color-primary)" : "none", boxShadow: i === step ? "0 0 0 4px var(--color-primary-tint)" : "none" }}
                      >
                        {(done || current) && <CheckGlyph color={done ? "#fff" : "var(--color-link)"} />}
                      </span>
                      <span className="text-[11px]" style={{ color: i <= step ? "var(--color-ink)" : "var(--color-muted)" }}>
                        {label}
                      </span>
                      <span className="text-center text-[10px] text-muted">{when}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
          {[
            ["Net payout", formatINR(run.totals.net), `${run.totals.live} employee${run.totals.live === 1 ? "" : "s"} · ${run.totals.held} on hold`],
            ["Commission included", formatINR(run.totals.commission), "Paid with this run’s salaries"],
            ["Deductions", formatINR(run.totals.deductions), "PF 12% of basic · PT · TDS"],
          ].map(([k, v, sub]) => (
            <div key={k} className={CARD}>
              <span className="text-sm font-medium">{k}</span>
              <span className="text-[28px] font-light">
                <FreshValue value={v} />
              </span>
              <span className="text-xs text-muted">{sub}</span>
            </div>
          ))}
        </div>
      )}

      {employees.length === 0 ? (
        <EmptyState className="rounded-card bg-card">Nobody is on payroll yet. Add members and their CTC in Teams.</EmptyState>
      ) : (
        <RowTable label="Payroll" minWidth={1000} columns={COLUMNS}>
          <RowHead>
            <HeadCell>Employee</HeadCell>
            <HeadCell>Date of joining</HeadCell>
            <HeadCell align="right">Current CTC</HeadCell>
            <HeadCell align="right">Download payslips</HeadCell>
          </RowHead>
          {employees.map((e) => (
            <EmployeeRow key={e.id} employee={e} />
          ))}
        </RowTable>
      )}

      <Presence value={review && run}>{(shown) => <PayslipReview run={shown} canEdit={canRun} onClose={() => setReview(false)} />}</Presence>
      {run && (
        <ConfirmDialog
          open={confirm !== null}
          tone="primary"
          cancelLabel="Not yet"
          title={confirm === "approve" ? `Approve the ${run.label} payroll?` : `Disburse the ${run.label} payroll?`}
          body={
            confirm === "approve"
              ? `${formatINR(run.totals.net)} net to ${run.totals.live} employees${run.totals.held ? ` (${run.totals.held} on hold)` : ""}. Payslips can't be changed after approval.`
              : `Records ${formatINR(run.totals.net)} paid to ${run.totals.live} employees, posts the salary cost to Finance and emails every payslip.`
          }
          confirmLabel={confirm === "approve" ? "Approve payroll" : "Mark as disbursed"}
          pending={approve.pending || disburse.pending}
          onConfirm={() => void (confirm === "approve" ? approve.run({ id: run.id }) : disburse.run({ id: run.id }))}
          onClose={() => setConfirm(null)}
        />
      )}
      {starting && next && <StartRunModal next={next} onClose={() => setStarting(false)} />}
    </Page>
  );
}

function EmployeeRow({ employee: e }: { employee: PayrollEmployeeDto }) {
  const [type, setType] = useState<StatementType>("MONTHLY");
  const [key, setKey] = useState<string | null>(null);
  const file = useDownload();
  const options = e.statements[type];
  const chosen = options.find((o) => o.key === key)?.key ?? options[0]?.key ?? null;
  return (
    <Row className="min-h-[60px]">
      <Cell className="flex items-center gap-2.5">
        <Avatar initials={e.initials} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{e.name}</span>
          <span className="truncate text-[11px] text-muted">{e.title}</span>
        </span>
      </Cell>
      <Cell>{e.dateOfJoining ? formatDate(e.dateOfJoining) : "—"}</Cell>
      <Cell align="right" className="font-medium">
        {e.ctcAnnualPaise ? formatINR(e.ctcAnnualPaise) : "—"}
      </Cell>
      <Cell className="flex items-center justify-end gap-1.5">
        <select
          aria-label={`Payslip period for ${e.name}`}
          value={type}
          onChange={(ev) => {
            setType(ev.target.value as StatementType);
            setKey(null);
          }}
          className={SELECT}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select aria-label={`Select period for ${e.name}`} value={chosen ?? ""} disabled={!options.length} onChange={(ev) => setKey(ev.target.value)} className={`${SELECT} max-w-[150px]`}>
          {options.length ? (
            options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))
          ) : (
            <option value="">No payslips yet</option>
          )}
        </select>
        <Button
          size="sm"
          icon="download"
          iconSize={13}
          disabled={!chosen}
          loading={file.pending !== null}
          onClick={() => chosen && void file.download(`/api/payslips/${e.id}/${type}/${encodeURIComponent(chosen)}`, "payslip.pdf")}
          className="h-[34px]"
        >
          Download
        </Button>
      </Cell>
    </Row>
  );
}

function StartRunModal({ next, onClose }: { next: { period: string; payDate: string }; onClose: () => void }) {
  const [payDate, setPayDate] = useState(next.payDate);
  const [error, setError] = useState<string | null>(null);
  const start = useAction(startPayrollRunAction, { onSuccess: onClose, onError: (r) => setError(r.error) });
  return (
    <Modal
      open
      onClose={onClose}
      width={440}
      title={`Start ${longMonthLabel(next.period)} payroll`}
      subtitle="Payslips are drafted from current CTCs for review"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={start.pending} onClick={() => void start.run({ period: next.period, payDate })}>
            Open for review
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Pay date</span>
        <input data-autofocus type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={FIELD} />
      </label>
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <Icon name="clock" size={13} /> Partners are not on payroll; employees without a CTC are skipped.
      </span>
      <FormError message={error} />
    </Modal>
  );
}
