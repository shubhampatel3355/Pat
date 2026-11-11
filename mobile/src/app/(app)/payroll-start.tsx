import { longMonthLabel } from "@shared/payroll";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { errorText } from "@/api/client";
import { runAction, useAction, usePayroll } from "@/api/queries";
import { DateField } from "@/components/ui/form";
import { EmptyState, ErrorState, Loading } from "@/components/ui/primitives";
import { FormScreen, Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";
import { fieldErrors } from "@/lib/forms";

/** Open the next month's payroll run (payslips are generated from current CTCs, as on the web). */
export default function PayrollStart() {
  const q = usePayroll();
  const start = useAction("payroll.start");
  const d = q.data && !("redirect" in q.data) ? q.data : null;
  const [payDate, setPayDate] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (q.data && "redirect" in q.data) return <Redirect href="/payslips" />;
  if (q.isPending) return <Screen title="Payroll" back><Loading /></Screen>;
  if (!d) return <Screen title="Payroll" back><ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} /></Screen>;
  if (!d.next) return <Screen title="Payroll" back><EmptyState icon="rupee" title="Nothing to start" text="Finish the open run first, or wait for next month." /></Screen>;
  const next = d.next;

  async function save() {
    const res = await runAction(start, { period: next.period, payDate: payDate ?? next.payDate });
    if (res.ok) router.back();
    else setErrors(fieldErrors(res));
  }

  return (
    <FormScreen title={`Start ${longMonthLabel(next.period)}`} onSubmit={save} saving={start.isPending} submitLabel="Start payroll run">
      <T variant="body" style={{ marginTop: 8 }}>
        Payslips are created for everyone on payroll from their CTC. You can then add commission, incentives and deductions before approving.
      </T>
      <DateField label="Pay date" value={payDate ?? next.payDate} onChange={setPayDate} error={errors.payDate} />
    </FormScreen>
  );
}
