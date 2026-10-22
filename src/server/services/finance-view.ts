import "server-only";
import type { KpiCardData } from "@/components/finance/kpi-card";
import { formatDate } from "@/lib/dates";
import { groupExpenses, yoyLabel } from "@/lib/finance";
import { formatCompactINR, formatINR } from "@/lib/money";
import type { FinanceOverview, FinanceReport, MonthPoint } from "./finance";

const compact = (paise: number) => formatCompactINR(paise, 1);
const pctText = (pct: number | null) => (pct === null ? "—" : `${pct}%`);
const clampPct = (pct: number | null) => Math.max(0, Math.min(100, pct ?? 0));
const bars = (points: MonthPoint[]) => points.map((m) => ({ value: m.paise, tip: `${m.label} · ${formatINR(m.paise)}` }));
const ticks = (points: MonthPoint[]) => [points[0]!.label, points[6]!.label, points[11]!.label];
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The six blue cards on the Finance overview (prototype order first: Revenue, Expenses, Profit, Receivables). */
export function kpiCards(o: FinanceOverview): KpiCardData[] {
  const expenses = groupExpenses(o.expenses.byCategory);
  const r = o.receivables;
  return [
    { title: "Revenue", icon: "trend", value: compact(o.revenue.paise), delta: yoyLabel(o.revenue.paise, o.revenue.prevPaise), chart: { type: "spark", bars: bars(o.revenue.months), ticks: ticks(o.revenue.months) } },
    {
      title: "Expenses",
      icon: "payroll",
      value: compact(o.expenses.paise),
      delta: yoyLabel(o.expenses.paise, o.expenses.prevPaise),
      chart: { type: "slider", bars: expenses.map((g) => ({ value: g.paise, tip: `${g.label} · ${formatINR(g.paise)}` })), ticks: expenses.map((g) => g.tick) },
    },
    { title: "Profit", icon: "finance", value: compact(o.profit.paise), delta: yoyLabel(o.profit.paise, o.profit.prevPaise), chart: { type: "ring", pct: clampPct(o.profit.marginPct), value: pctText(o.profit.marginPct), caption: "margin" } },
    {
      title: "Receivables",
      icon: "clock",
      value: compact(r.outstandingPaise),
      delta: plural(r.open.length, "invoice") + (r.overdueCount ? ` · ${r.overdueCount} overdue` : ""),
      chart: { type: "gauge", pct: clampPct(r.collectedPct), value: pctText(r.collectedPct), caption: "Collected of FY billing" },
    },
    { title: "Collections", icon: "download", value: compact(o.collections.paise), delta: yoyLabel(o.collections.paise, o.collections.prevPaise), chart: { type: "spark", bars: bars(o.collections.months), ticks: ticks(o.collections.months) } },
    { title: "Payroll", icon: "teams", value: compact(o.payroll.paise), delta: yoyLabel(o.payroll.paise, o.payroll.prevPaise), chart: { type: "stadium", pct: clampPct(o.payroll.pctOfRevenue), value: pctText(o.payroll.pctOfRevenue), caption: "Of revenue" } },
  ];
}

export interface FinanceReportView {
  fyLabel: string;
  periodLabel: string;
  generatedOn: string;
  tiles: { label: string; value: string; sub: string }[];
  pnl: { label: string; value: string; strong?: boolean; indent?: boolean }[];
  monthly: { label: string; cells: string[] }[];
  monthlyTotal: string[];
  ageing: { label: string; value: string; count: number }[];
  receivables: { number: string; client: string; due: string; overdue: string; outstanding: string }[];
  moreReceivables: number;
  notes: string[];
}

const RECEIVABLE_ROWS = 15;

/** Display strings for the printable finance report (src/components/finance/finance-report-document.tsx). */
export function reportView(report: FinanceReport, generatedOn: string): FinanceReportView {
  const o = report.overview;
  const p = o.period;
  const lastYear = (paise: number, prev: number) => yoyLabel(paise, prev) || "No comparison";
  const inPeriod = (m: MonthPoint) => m.month <= p.to.slice(0, 7);
  const months = o.revenue.months.filter(inPeriod);
  const col = (points: MonthPoint[], month: string) => points.find((x) => x.month === month)?.paise ?? 0;
  return {
    fyLabel: p.fy.label,
    periodLabel: p.toDate ? `${p.label} · year to date` : p.label,
    generatedOn,
    tiles: [
      { label: "Revenue", value: formatINR(o.revenue.paise), sub: lastYear(o.revenue.paise, o.revenue.prevPaise) },
      { label: "Expenses", value: formatINR(o.expenses.paise), sub: lastYear(o.expenses.paise, o.expenses.prevPaise) },
      { label: "Profit", value: formatINR(o.profit.paise), sub: o.profit.marginPct === null ? "No revenue yet" : `${o.profit.marginPct}% margin` },
      { label: "Receivables", value: formatINR(o.receivables.outstandingPaise), sub: `${plural(o.receivables.open.length, "invoice")} · ${formatINR(o.receivables.overduePaise)} overdue` },
      { label: "Collections", value: formatINR(o.collections.paise), sub: "Receipts incl. GST" },
      { label: "Payroll", value: formatINR(o.payroll.paise), sub: o.payroll.pctOfRevenue === null ? "—" : `${o.payroll.pctOfRevenue}% of revenue` },
    ],
    pnl: [
      { label: `Fees invoiced (${plural(o.billing.invoiceCount, "invoice")})`, value: formatINR(o.billing.invoiceFeesPaise) },
      { label: `Less credit notes (${o.billing.creditCount})`, value: o.billing.creditFeesPaise ? `− ${formatINR(o.billing.creditFeesPaise)}` : formatINR(0) },
      { label: "Revenue (excl. GST)", value: formatINR(o.revenue.paise), strong: true },
      { label: "Other income", value: formatINR(o.otherIncomePaise) },
      ...o.expenses.byCategory.map((c) => ({ label: c.category, value: `− ${formatINR(c.paise)}`, indent: true })),
      { label: "Total expenses", value: `− ${formatINR(o.expenses.paise)}` },
      { label: o.profit.marginPct === null ? "Profit" : `Profit (${o.profit.marginPct}% margin)`, value: formatINR(o.profit.paise), strong: true },
    ],
    monthly: months.map((m) => ({
      label: `${m.label} ${m.month.slice(0, 4)}`,
      cells: [m.paise, col(o.collections.months, m.month), col(o.expenses.months, m.month), col(o.payroll.months, m.month)].map((v) => formatINR(v)),
    })),
    monthlyTotal: [o.revenue.paise, o.collections.paise, o.expenses.paise, o.payroll.paise].map((v) => formatINR(v)),
    ageing: o.receivables.ageing.map((a) => ({ label: a.label, value: formatINR(a.paise), count: a.count })),
    receivables: o.receivables.open.slice(0, RECEIVABLE_ROWS).map((r) => ({
      number: r.number,
      client: r.payeeName,
      due: r.dueDate ? formatDate(r.dueDate) : "—",
      overdue: r.daysOverdue ? `${r.daysOverdue} d` : "Not due",
      outstanding: formatINR(r.outstandingPaise),
    })),
    moreReceivables: Math.max(0, o.receivables.open.length - RECEIVABLE_ROWS),
    notes: [
      "Revenue is the fees on tax invoices issued in the period, excluding GST and net of credit notes. Collections are receipts including GST.",
      "Profit = revenue + other income (receipts not tied to an invoice) − expenses. Payroll is the Salaries expense category.",
      p.toDate ? `Year-on-year comparisons use the same dates last year (${formatDate(p.prevFrom)} – ${formatDate(p.prevTo)}).` : `Year-on-year comparisons use ${formatDate(p.prevFrom)} – ${formatDate(p.prevTo)}.`,
      "Receivables are what is still unpaid today on invoices issued up to the end of the period.",
    ],
  };
}
