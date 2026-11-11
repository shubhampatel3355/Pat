import { professionalTax, tdsEstimate } from "@shared/payroll";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { errorText } from "@/api/client";
import { runAction, useAction, usePayroll } from "@/api/queries";
import type { PayrollRun, PayslipRow } from "@/api/types";
import { AmountField, Field, SwitchRow } from "@/components/ui/form";
import { Card, EmptyState, ErrorState, KeyValue, ListCard, Loading } from "@/components/ui/primitives";
import { FormScreen, Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";
import { fieldErrors, param } from "@/lib/forms";
import { formatINR, paiseToInput, parseRupeesToPaise } from "@/lib/format";

/** One payslip in a run: review inputs (commission, incentive, other deductions, TDS, hold) while the run is in review. */
export default function PayslipForm() {
  const params = useLocalSearchParams<{ id?: string }>();
  const q = usePayroll();
  const d = q.data && !("redirect" in q.data) ? q.data : null;
  if (q.isPending) return <Screen title="Payslip" back><Loading /></Screen>;
  if (!d?.run) return <Screen title="Payslip" back><ErrorState message={errorText(q.error) || "No payroll run"} onRetry={() => void q.refetch()} /></Screen>;
  const slip = d.run.payslips.find((p) => p.id === param(params.id));
  if (!slip) return <Screen title="Payslip" back><EmptyState icon="file" title="Payslip not found" /></Screen>;
  return <Form run={d.run} slip={slip} editable={d.canRun && d.run.status === "REVIEW"} />;
}

function Form({ run, slip, editable }: { run: PayrollRun; slip: PayslipRow; editable: boolean }) {
  const update = useAction("payroll.updatePayslip");
  const c = slip.components;
  const [commission, setCommission] = useState(paiseToInput(c.commission));
  const [incentive, setIncentive] = useState(paiseToInput(c.incentive));
  const [other, setOther] = useState(paiseToInput(c.other));
  const [tdsOverride, setTdsOverride] = useState(Boolean(c.tdsOverridden));
  const [tds, setTds] = useState(paiseToInput(c.tds));
  const [onHold, setOnHold] = useState(slip.onHold);
  const [note, setNote] = useState(c.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Live preview with the web's payroll rules (src/lib/payroll.ts): PF is fixed by basic; PT and TDS follow gross.
  const comm = parseRupeesToPaise(commission) ?? 0;
  const inc = parseRupeesToPaise(incentive) ?? 0;
  const oth = parseRupeesToPaise(other) ?? 0;
  const gross = c.basic + c.hra + c.special + comm + inc;
  const pt = professionalTax(gross, run.period);
  const tdsValue = tdsOverride ? (parseRupeesToPaise(tds) ?? 0) : tdsEstimate(gross);
  const deductions = c.pf + pt + tdsValue + oth;

  async function save() {
    const res = await runAction(update, { id: slip.id, commissionPaise: comm, incentivePaise: inc, otherPaise: oth, tdsPaise: tdsOverride ? (parseRupeesToPaise(tds) ?? 0) : null, onHold, note });
    if (res.ok) router.back();
    else setErrors(fieldErrors(res));
  }

  const breakdown = (
    <ListCard style={{ marginTop: 16 }}>
      <KeyValue first k="Basic" v={formatINR(c.basic)} />
      <KeyValue k="HRA" v={formatINR(c.hra)} />
      <KeyValue k="Special allowance" v={formatINR(c.special)} />
      <KeyValue k="Commission" v={formatINR(comm)} />
      <KeyValue k="Incentive" v={formatINR(inc)} />
      <KeyValue k="Gross" v={formatINR(gross)} />
      <KeyValue k="PF (12% of basic)" v={`− ${formatINR(c.pf)}`} />
      <KeyValue k="Professional tax" v={`− ${formatINR(pt)}`} />
      <KeyValue k={tdsOverride ? "TDS (entered)" : "TDS (estimate)"} v={`− ${formatINR(tdsValue)}`} />
      <KeyValue k="Other deductions" v={`− ${formatINR(oth)}`} />
      <KeyValue k="Net pay" v={<T variant="strong" weight="bold" align="right" style={{ flex: 1 }}>{formatINR(gross - deductions)}</T>} />
    </ListCard>
  );

  if (!editable) {
    return (
      <Screen title={slip.user.name} sub={`${run.label} · ${c.daysPaid}/${c.daysInMonth} days`} back>
        {breakdown}
        {slip.onHold ? <T variant="small" style={{ marginTop: 12 }}>On hold — not paid in this run.</T> : null}
        {c.note ? <T variant="small" style={{ marginTop: 12 }}>Note: {c.note}</T> : null}
      </Screen>
    );
  }

  return (
    <FormScreen title={slip.user.name} sub={`${run.label} · ${c.daysPaid}/${c.daysInMonth} days paid`} onSubmit={save} saving={update.isPending}>
      <AmountField label="Commission" value={commission} onChange={setCommission} error={errors.commissionPaise} />
      <AmountField label="Incentive" value={incentive} onChange={setIncentive} error={errors.incentivePaise} />
      <AmountField label="Other deductions" value={other} onChange={setOther} error={errors.otherPaise} />
      <Card style={{ marginTop: 16, paddingVertical: 6 }}>
        <SwitchRow label="Enter TDS by hand" sub="Otherwise 10% of gross above ₹ 50,000" value={tdsOverride} onChange={setTdsOverride} />
        <SwitchRow label="Hold this payslip" sub="Left out of this run's disbursal" value={onHold} onChange={setOnHold} />
      </Card>
      {tdsOverride ? <AmountField label="TDS" value={tds} onChange={setTds} error={errors.tdsPaise} /> : null}
      <Field label="Note" value={note} onChangeText={setNote} error={errors.note} placeholder="Shown on the payslip" />
      <View>{breakdown}</View>
    </FormScreen>
  );
}
