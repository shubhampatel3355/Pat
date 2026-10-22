import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FinanceReportDocument } from "@/components/finance/finance-report-document";
import { financialYear, formatDateTime, fyOfIso, isoDateIST } from "@/lib/dates";
import { getApiUser } from "@/server/auth/session";
import { companyProfile } from "@/server/company";
import { verifyPayload } from "@/server/crypto";
import { can } from "@/server/policy";
import { financeReport } from "@/server/services/finance";
import { reportView } from "@/server/services/finance-view";

export const metadata: Metadata = { title: "Finance report" };

/** Bare, printable finance report for one FY. Used by Chromium (signed `t` token) and by people who may export finance. */
export default async function PrintFinancePage({ params, searchParams }: { params: Promise<{ fy: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { fy } = await params;
  const sp = await searchParams;
  const token = verifyPayload<{ kind: string; fy: string }>("print", typeof sp.t === "string" ? sp.t : null);
  let allowed = token?.kind === "finance" && token.fy === fy;
  if (!allowed) {
    const user = await getApiUser();
    allowed = Boolean(user && can(user, "export", { type: "finance" }));
  }
  const today = isoDateIST();
  if (!allowed || !/^\d{4}$/.test(fy) || Number(fy) > fyOfIso(today).startYear) notFound();
  const report = await financeReport(financialYear(Number(fy)), today);
  return (
    <main style={{ display: "flex", justifyContent: "center", background: "#fff" }}>
      <FinanceReportDocument view={reportView(report, formatDateTime(new Date()))} company={companyProfile()} />
    </main>
  );
}
