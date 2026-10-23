import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayslipDocument } from "@/components/payroll/payslip-document";
import type { StatementType } from "@/lib/payroll";
import { getApiUser } from "@/server/auth/session";
import { companyProfile } from "@/server/company";
import { verifyPayload } from "@/server/crypto";
import { can } from "@/server/policy";
import { statementFor } from "@/server/services/payroll";

export const metadata: Metadata = { title: "Payslip" };

const TYPES: StatementType[] = ["MONTHLY", "QUARTERLY", "YEARLY"];

/** Bare, printable payslip / pay statement. Used by Chromium (signed `t` token) and by the employee or payroll managers. */
export default async function PrintPayslipPage({ params, searchParams }: { params: Promise<{ userId: string; periodType: string; period: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { userId, periodType, period } = await params;
  const key = decodeURIComponent(period);
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !TYPES.includes(periodType as StatementType)) notFound();
  const token = verifyPayload<{ kind: string; userId: string; periodType: string; period: string }>("print", typeof sp.t === "string" ? sp.t : null);
  let allowed = token?.kind === "payslip" && token.userId === userId && token.periodType === periodType && token.period === key;
  if (!allowed) {
    const user = await getApiUser();
    allowed = Boolean(user && can(user, "view", { type: "payroll", userId }));
  }
  if (!allowed) notFound();
  const statement = await statementFor(userId, periodType as StatementType, key);
  if (!statement) notFound();
  return (
    <main style={{ display: "flex", justifyContent: "center", background: "#fff" }}>
      <PayslipDocument
        company={companyProfile()}
        view={{ type: statement.period.type, periodLabel: statement.period.label, months: statement.months, payDate: statement.payDate, employee: statement.user, components: statement.components }}
      />
    </main>
  );
}
