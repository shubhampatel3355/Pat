import "server-only";
import type { LedgerType, PaymentMode } from "@/generated/prisma/enums";
import { dateToIso, financialYear, fyMonths, fyOfIso, isoDateIST, isoToDate, monthLabel, type FinancialYear } from "@/lib/dates";
import { AGEING_BUCKETS, ageingBucket, daysOverdue, financePeriod, PAYROLL_CATEGORY, sharePct, type FinancePeriod } from "@/lib/finance";
import { toPaise } from "@/lib/money";
import { db } from "../db";
import { creditedPaise, outstandingPaise } from "./invoices";
import { billingTotals, monthlyRevenue, revenueOf, type BillingTotals } from "./revenue";

// Definitions (revenue, profit, receivables…) live in src/lib/finance.ts.

/** Financial years that have invoices or ledger entries, newest first (always includes the current one). */
export async function financeYears(today = isoDateIST()): Promise<FinancialYear[]> {
  const current = fyOfIso(today).startYear;
  const [invoice, entry] = await Promise.all([
    db.invoice.findFirst({ where: { type: "INVOICE" }, orderBy: { issueDate: "asc" }, select: { issueDate: true } }),
    db.ledgerEntry.findFirst({ where: { deletedAt: null }, orderBy: { entryDate: "asc" }, select: { entryDate: true } }),
  ]);
  const starts = [invoice?.issueDate, entry?.entryDate].flatMap((d) => (d ? [fyOfIso(dateToIso(d)).startYear] : []));
  const first = Math.max(current - 9, Math.min(current, ...starts));
  return Array.from({ length: current - first + 1 }, (_, i) => financialYear(current - i));
}

// ── Ledger ────────────────────────────────────────────────────────────────────

interface LedgerSums {
  incomePaise: number;
  /** Receipts not tied to an invoice payment (interest, advisory retainers…). */
  otherIncomePaise: number;
  expensePaise: number;
  payrollPaise: number;
  expenseByCategory: { category: string; paise: number }[];
  incomeByCategory: { category: string; paise: number }[];
  months: Map<string, { income: number; expense: number; payroll: number }>;
}

async function ledgerSums(fromIso: string, toIso: string): Promise<LedgerSums> {
  const rows = await db.$queryRaw<{ type: LedgerType; category: string; month: string; linked: boolean; total: bigint }[]>`
    SELECT type::text AS type, category, to_char(entry_date, 'YYYY-MM') AS month, (payment_id IS NOT NULL) AS linked,
           SUM(amount_paise)::bigint AS total
    FROM ledger_entries
    WHERE deleted_at IS NULL AND entry_date BETWEEN ${isoToDate(fromIso)} AND ${isoToDate(toIso)}
    GROUP BY 1, 2, 3, 4`;
  const sums: LedgerSums = { incomePaise: 0, otherIncomePaise: 0, expensePaise: 0, payrollPaise: 0, expenseByCategory: [], incomeByCategory: [], months: new Map() };
  const byCategory = { INCOME: new Map<string, number>(), EXPENSE: new Map<string, number>() };
  for (const r of rows) {
    const paise = Number(r.total);
    const month = sums.months.get(r.month) ?? { income: 0, expense: 0, payroll: 0 };
    byCategory[r.type].set(r.category, (byCategory[r.type].get(r.category) ?? 0) + paise);
    if (r.type === "INCOME") {
      sums.incomePaise += paise;
      if (!r.linked) sums.otherIncomePaise += paise;
      month.income += paise;
    } else {
      sums.expensePaise += paise;
      month.expense += paise;
      if (r.category === PAYROLL_CATEGORY) {
        sums.payrollPaise += paise;
        month.payroll += paise;
      }
    }
    sums.months.set(r.month, month);
  }
  const sorted = (m: Map<string, number>) => [...m].map(([category, paise]) => ({ category, paise })).sort((a, b) => b.paise - a.paise);
  sums.expenseByCategory = sorted(byCategory.EXPENSE);
  sums.incomeByCategory = sorted(byCategory.INCOME);
  return sums;
}

export interface LedgerRowDto {
  id: string;
  type: LedgerType;
  date: string;
  description: string;
  category: string;
  party: string | null;
  mode: PaymentMode;
  amountPaise: number;
  /** Payment-linked rows are reversed from Invoice and payroll rows from Payroll, never voided here. */
  source: "payment" | "payroll" | "manual";
  recordedBy: string;
}

export async function ledgerEntries(fromIso: string, toIso: string, take?: number): Promise<LedgerRowDto[]> {
  const rows = await db.ledgerEntry.findMany({
    where: { deletedAt: null, entryDate: { gte: isoToDate(fromIso), lte: isoToDate(toIso) } },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take,
    include: { createdBy: { select: { name: true } } },
  });
  return rows.map((e) => ({
    id: e.id,
    type: e.type,
    date: dateToIso(e.entryDate),
    description: e.description,
    category: e.category,
    party: e.party,
    mode: e.mode,
    amountPaise: toPaise(e.amountPaise),
    source: e.paymentId ? "payment" : e.payrollRunId ? "payroll" : "manual",
    recordedBy: e.createdBy.name,
  }));
}

// ── Receivables ───────────────────────────────────────────────────────────────

export interface ReceivableRow {
  id: string;
  number: string;
  payeeName: string;
  issueDate: string;
  dueDate: string | null;
  totalPaise: number;
  paidPaise: number;
  creditedPaise: number;
  outstandingPaise: number;
  daysOverdue: number;
  bucket: 0 | 1 | 2 | 3;
}

export interface Receivables {
  open: ReceivableRow[];
  outstandingPaise: number;
  overduePaise: number;
  overdueCount: number;
  ageing: { label: string; paise: number; count: number }[];
  /** Invoices issued in the period, net of credit notes, incl. GST — and how much of that is in. */
  billedPaise: number;
  collectedPaise: number;
  collectedPct: number | null;
}

/**
 * Outstanding today on invoices issued up to the end of the period (earlier years' unpaid invoices are
 * still receivable), plus how much of the period's own billing has been collected.
 */
async function receivables(period: FinancePeriod, today: string): Promise<Receivables> {
  const rows = await db.invoice.findMany({
    where: {
      type: "INVOICE",
      status: { not: "CANCELLED" },
      issueDate: { lte: isoToDate(period.to) },
      OR: [{ status: { in: ["ISSUED", "PARTIALLY_PAID"] } }, { issueDate: { gte: isoToDate(period.from) } }],
    },
    select: { id: true, number: true, payeeName: true, issueDate: true, dueDate: true, type: true, totalPaise: true, amountPaidPaise: true, creditNotes: { select: { totalPaise: true } } },
    orderBy: { issueDate: "asc" },
  });
  const result: Receivables = { open: [], outstandingPaise: 0, overduePaise: 0, overdueCount: 0, ageing: AGEING_BUCKETS.map((label) => ({ label, paise: 0, count: 0 })), billedPaise: 0, collectedPaise: 0, collectedPct: null };
  for (const inv of rows) {
    const issueDate = dateToIso(inv.issueDate);
    const credited = creditedPaise(inv);
    const paid = toPaise(inv.amountPaidPaise);
    if (issueDate >= period.from) {
      const billed = toPaise(inv.totalPaise) - credited;
      result.billedPaise += billed;
      result.collectedPaise += Math.min(paid, billed);
    }
    const outstanding = outstandingPaise(inv);
    if (outstanding <= 0) continue;
    const dueDate = inv.dueDate ? dateToIso(inv.dueDate) : null;
    const overdue = daysOverdue(dueDate, today);
    const bucket = ageingBucket(dueDate, today);
    result.open.push({ id: inv.id, number: inv.number, payeeName: inv.payeeName, issueDate, dueDate, totalPaise: toPaise(inv.totalPaise), paidPaise: paid, creditedPaise: credited, outstandingPaise: outstanding, daysOverdue: overdue, bucket });
    result.outstandingPaise += outstanding;
    result.ageing[bucket]!.paise += outstanding;
    result.ageing[bucket]!.count += 1;
    if (overdue > 0) {
      result.overduePaise += outstanding;
      result.overdueCount += 1;
    }
  }
  result.open.sort((a, b) => b.daysOverdue - a.daysOverdue || b.outstandingPaise - a.outstandingPaise);
  result.collectedPct = sharePct(result.collectedPaise, result.billedPaise);
  return result;
}

// ── Overview ──────────────────────────────────────────────────────────────────

export interface MonthPoint {
  month: string;
  label: string;
  paise: number;
}

export interface FinanceOverview {
  period: FinancePeriod;
  billing: BillingTotals;
  revenue: { paise: number; prevPaise: number; months: MonthPoint[] };
  otherIncomePaise: number;
  incomeByCategory: { category: string; paise: number }[];
  expenses: { paise: number; prevPaise: number; byCategory: { category: string; paise: number }[]; months: MonthPoint[] };
  profit: { paise: number; prevPaise: number; marginPct: number | null };
  collections: { paise: number; prevPaise: number; months: MonthPoint[] };
  payroll: { paise: number; prevPaise: number; months: MonthPoint[]; pctOfRevenue: number | null };
  receivables: Receivables;
}

export async function financeOverview(fy: FinancialYear, today = isoDateIST()): Promise<FinanceOverview> {
  const period = financePeriod(fy, today);
  const [billing, prevBilling, revenueMonths, ledger, prevLedger, rec] = await Promise.all([
    billingTotals(period.from, period.to),
    billingTotals(period.prevFrom, period.prevTo),
    monthlyRevenue(period.from, period.to),
    ledgerSums(period.from, period.to),
    ledgerSums(period.prevFrom, period.prevTo),
    receivables(period, today),
  ]);
  const months = fyMonths(fy);
  const series = (value: (month: string) => number): MonthPoint[] => months.map((m) => ({ month: m, label: monthLabel(Number(m.slice(5))), paise: value(m) }));
  const revenue = revenueOf(billing);
  const prevRevenue = revenueOf(prevBilling);
  const profit = revenue + ledger.otherIncomePaise - ledger.expensePaise;
  return {
    period,
    billing,
    revenue: { paise: revenue, prevPaise: prevRevenue, months: series((m) => revenueMonths.get(m) ?? 0) },
    otherIncomePaise: ledger.otherIncomePaise,
    incomeByCategory: ledger.incomeByCategory,
    expenses: { paise: ledger.expensePaise, prevPaise: prevLedger.expensePaise, byCategory: ledger.expenseByCategory, months: series((m) => ledger.months.get(m)?.expense ?? 0) },
    profit: { paise: profit, prevPaise: prevRevenue + prevLedger.otherIncomePaise - prevLedger.expensePaise, marginPct: sharePct(profit, revenue + ledger.otherIncomePaise) },
    collections: { paise: ledger.incomePaise, prevPaise: prevLedger.incomePaise, months: series((m) => ledger.months.get(m)?.income ?? 0) },
    payroll: { paise: ledger.payrollPaise, prevPaise: prevLedger.payrollPaise, months: series((m) => ledger.months.get(m)?.payroll ?? 0), pctOfRevenue: sharePct(ledger.payrollPaise, revenue) },
    receivables: rec,
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────

export interface RegisterRow {
  number: string;
  type: "INVOICE" | "CREDIT_NOTE";
  issueDate: string;
  dueDate: string | null;
  payeeName: string;
  gstin: string | null;
  against: string | null;
  feesPaise: number;
  gstPaise: number;
  totalPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  status: string;
}

/** Tax invoices and credit notes issued in the period, oldest first. */
export async function invoiceRegister(fromIso: string, toIso: string): Promise<RegisterRow[]> {
  const rows = await db.invoice.findMany({
    where: { type: { in: ["INVOICE", "CREDIT_NOTE"] }, issueDate: { gte: isoToDate(fromIso), lte: isoToDate(toIso) } },
    orderBy: [{ issueDate: "asc" }, { number: "asc" }],
    select: {
      number: true, type: true, status: true, issueDate: true, dueDate: true, payeeName: true, gstin: true, feesPaise: true, cgstPaise: true, sgstPaise: true, igstPaise: true, totalPaise: true, amountPaidPaise: true,
      creditNoteFor: { select: { number: true } },
      creditNotes: { select: { totalPaise: true } },
    },
  });
  return rows.map((r) => ({
    number: r.number,
    type: r.type as RegisterRow["type"],
    issueDate: dateToIso(r.issueDate),
    dueDate: r.dueDate ? dateToIso(r.dueDate) : null,
    payeeName: r.payeeName,
    gstin: r.gstin,
    against: r.creditNoteFor?.number ?? null,
    feesPaise: toPaise(r.feesPaise),
    gstPaise: toPaise(r.cgstPaise) + toPaise(r.sgstPaise) + toPaise(r.igstPaise),
    totalPaise: toPaise(r.totalPaise),
    paidPaise: toPaise(r.amountPaidPaise),
    outstandingPaise: outstandingPaise(r),
    status: r.status,
  }));
}

export interface FinanceReport {
  overview: FinanceOverview;
  ledger: LedgerRowDto[];
  register: RegisterRow[];
}

export async function financeReport(fy: FinancialYear, today = isoDateIST()): Promise<FinanceReport> {
  const overview = await financeOverview(fy, today);
  const [ledger, register] = await Promise.all([ledgerEntries(overview.period.from, overview.period.to), invoiceRegister(overview.period.from, overview.period.to)]);
  return { overview, ledger, register };
}
