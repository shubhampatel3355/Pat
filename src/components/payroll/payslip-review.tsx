"use client";

import { useState } from "react";
import { formatINR, paiseToInput, parseRupeesToPaise } from "@/lib/money";
import { tdsEstimate } from "@/lib/payroll";
import { recalculateRunAction, updatePayslipAction } from "@/server/actions/payroll";
import type { PayslipRowDto, RunDto } from "@/server/services/payroll";
import { Avatar, StatusPill, Toggle } from "../ui/bits";
import { Button } from "../ui/button";
import { FormError, inputClass } from "../ui/field";
import { Drawer } from "../ui/overlay";
import { useAction } from "../ui/toast";

const STATUS_LABEL = { REVIEW: "In review — edit commission, incentives and deductions before approval", APPROVED: "Approved — payslips are locked", DISBURSED: "Disbursed — payslips were emailed" } as const;

export function PayslipReview({ run, canEdit, onClose }: { run: RunDto; canEdit: boolean; onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const editable = canEdit && run.status === "REVIEW";
  const recalc = useAction(recalculateRunAction);
  return (
    <Drawer
      open
      onClose={onClose}
      width={600}
      title={`Payslips · ${run.label}`}
      subtitle={STATUS_LABEL[run.status]}
      footer={
        editable ? (
          <Button variant="secondary" className="mr-auto" loading={recalc.pending} onClick={() => void recalc.run({ id: run.id })}>
            Recalculate from CTCs
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-1">
        {run.payslips.map((p) => (
          <div key={p.id} className="flex flex-col gap-3 rounded-row bg-surface p-3">
            <button
              type="button"
              disabled={!editable}
              aria-expanded={open === p.id}
              onClick={() => setOpen(open === p.id ? null : p.id)}
              className="flex items-center gap-2.5 border-0 bg-transparent p-0 text-left disabled:cursor-default"
            >
              <Avatar initials={p.user.initials} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{p.user.name}</span>
                <span className="text-[11px] text-muted">
                  {p.components.daysPaid} of {p.components.daysInMonth} days · gross {formatINR(p.totals.gross)} · deductions {formatINR(p.totals.deductions)}
                </span>
              </span>
              {p.onHold && <StatusPill color="#F5B73B">On hold</StatusPill>}
              <span className="text-sm font-medium tabular-nums">{formatINR(p.totals.net)}</span>
            </button>
            {open === p.id && editable && <PayslipEditor key={`${p.id}-${p.totals.net}-${p.onHold}`} slip={p} onDone={() => setOpen(null)} />}
          </div>
        ))}
      </div>
    </Drawer>
  );
}

function MoneyInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="flex h-10 items-center gap-2 rounded-[14px] bg-white px-3 shadow-inset focus-within:shadow-focus">
        <span className="text-sm text-muted">₹</span>
        <input inputMode="decimal" value={value} placeholder={placeholder ?? "0"} onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ""))} className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
      </span>
    </label>
  );
}

function PayslipEditor({ slip, onDone }: { slip: PayslipRowDto; onDone: () => void }) {
  const c = slip.components;
  const [commission, setCommission] = useState(c.commission ? paiseToInput(c.commission) : "");
  const [incentive, setIncentive] = useState(c.incentive ? paiseToInput(c.incentive) : "");
  const [other, setOther] = useState(c.other ? paiseToInput(c.other) : "");
  const [tds, setTds] = useState(c.tdsOverridden ? paiseToInput(c.tds) : "");
  const [note, setNote] = useState(c.note ?? "");
  const [hold, setHold] = useState(slip.onHold);
  const [error, setError] = useState<string | null>(null);
  const save = useAction(updatePayslipAction, { onSuccess: onDone, onError: (r) => setError(r.error) });
  const money = (v: string) => parseRupeesToPaise(v) ?? 0;
  const estimate = tdsEstimate(c.basic + c.hra + c.special + money(commission) + money(incentive));

  return (
    <div className="flex flex-col gap-3 border-t border-chip pt-3">
      <div className="grid grid-cols-2 gap-2">
        <MoneyInput label="Commission" value={commission} onChange={setCommission} />
        <MoneyInput label="Incentive" value={incentive} onChange={setIncentive} />
        <MoneyInput label="TDS" value={tds} onChange={setTds} placeholder={`Estimate ${paiseToInput(estimate) || "0"}`} />
        <MoneyInput label="Other deductions" value={other} onChange={setOther} />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Note on the payslip</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Includes Q2 incentive" className={inputClass("light", "h-10 bg-white px-3")} />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Toggle showLabel label="Hold this payslip" checked={hold} onChange={setHold} />
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button
            loading={save.pending}
            onClick={() =>
              void save.run({ id: slip.id, commissionPaise: money(commission), incentivePaise: money(incentive), otherPaise: money(other), tdsPaise: tds.trim() ? money(tds) : null, onHold: hold, note })
            }
          >
            Save payslip
          </Button>
        </div>
      </div>
      <FormError message={error} />
    </div>
  );
}
