import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PayrollScreen } from "@/components/payroll/payroll-screen";
import { requireUser } from "@/server/auth/session";
import { can, has } from "@/server/policy";
import { latestRun, nextRunPeriod, payrollEmployees } from "@/server/services/payroll";

export const metadata: Metadata = { title: "Payroll" };

export default async function PayrollPage() {
  const user = await requireUser();
  if (!can(user, "view", { type: "payroll" })) notFound();
  const manager = has(user, "payroll.view_all");
  // People who only see their own pay use Payslips & Incentive.
  if (!manager && user.role !== "OWNER") redirect("/payslips");
  const [run, next, employees] = await Promise.all([manager ? latestRun() : Promise.resolve(null), manager ? nextRunPeriod() : Promise.resolve(null), payrollEmployees(user)]);
  return <PayrollScreen run={run} next={next} employees={employees} manager={manager} canRun={has(user, "payroll.run")} />;
}
