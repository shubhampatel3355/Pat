import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MyPayScreen } from "@/components/payroll/my-pay-screen";
import { isoDateIST } from "@/lib/dates";
import { shortMonthLabel } from "@/lib/payroll";
import { requireUser } from "@/server/auth/session";
import { incentiveFor } from "@/server/services/incentive";
import { payrollEmployees } from "@/server/services/payroll";

export const metadata: Metadata = { title: "Payslips & Incentive" };

export default async function PayslipsPage() {
  const user = await requireUser();
  // Partners are not on payroll.
  if (user.role === "OWNER") redirect("/payroll");
  const today = isoDateIST();
  const [employees, incentive] = await Promise.all([payrollEmployees(user), incentiveFor(user.id, today)]);
  const me = employees.find((e) => e.id === user.id);
  if (!me) notFound();
  return <MyPayScreen me={me} incentive={incentive} monthLabel={shortMonthLabel(today.slice(0, 7))} />;
}
