import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FinanceScreen } from "@/components/finance/finance-screen";
import { isoDateIST } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/policy";
import { financeOverview, financeYears, ledgerEntries } from "@/server/services/finance";
import { kpiCards } from "@/server/services/finance-view";

export const metadata: Metadata = { title: "Finance" };

const RECENT_ENTRIES = 10;

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "view", { type: "finance" })) notFound();
  const sp = await searchParams;
  const today = isoDateIST();
  const years = await financeYears(today);
  const asked = typeof sp.fy === "string" ? Number(sp.fy) : NaN;
  const fy = years.find((y) => y.startYear === asked) ?? years[0]!;
  const canRecord = can(user, "record", { type: "finance" });

  const overview = await financeOverview(fy, today);
  const entries = await ledgerEntries(overview.period.from, overview.period.to, RECENT_ENTRIES);

  return (
    <FinanceScreen
      fy={fy.startYear}
      years={years.map((y) => ({ value: y.startYear, label: y.label }))}
      periodLabel={overview.period.toDate ? `${fy.label} · ${overview.period.label} · year to date` : `${fy.label} · ${overview.period.label}`}
      cards={kpiCards(overview)}
      entries={entries.map((e) => ({ id: e.id, type: e.type, date: e.date, description: e.description, category: e.category, party: e.party, mode: e.mode, amountPaise: e.amountPaise, voidable: e.source === "manual" }))}
      today={today}
      initialEntry={canRecord && sp.expense === "1" ? "EXPENSE" : null}
      can={{ record: canRecord, export: can(user, "export", { type: "finance" }) }}
    />
  );
}
