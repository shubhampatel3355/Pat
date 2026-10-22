/**
 * Finance definitions shared by the overview, the exports and their tests.
 *
 * Revenue  = fees (excl. GST) of tax invoices issued in the period, net of credit notes.
 * Expenses = ledger expenses dated in the period (payroll posts there as "Salaries").
 * Profit   = revenue + other income (ledger income not tied to an invoice payment) − expenses.
 * Collections are cash receipts (incl. GST); receivables are what is still unpaid on issued invoices.
 */

import { financialYear, fyToDateLabel, sameDayLastYear, type FinancialYear } from "./dates";

export interface FinancePeriod {
  fy: FinancialYear;
  /** The FY is still running: figures are year-to-date and compared with the same days last year. */
  toDate: boolean;
  from: string;
  to: string;
  /** "Apr – Oct 2026" or "Apr 2025 – Mar 2026". */
  label: string;
  prevFrom: string;
  prevTo: string;
}

export function financePeriod(fy: FinancialYear, today: string): FinancePeriod {
  const toDate = today >= fy.start && today <= fy.end;
  const prev = financialYear(fy.startYear - 1);
  return {
    fy,
    toDate,
    from: fy.start,
    to: toDate ? today : fy.end,
    label: toDate ? fyToDateLabel(fy, today) : `Apr ${fy.startYear} – Mar ${fy.startYear + 1}`,
    prevFrom: prev.start,
    prevTo: toDate ? sameDayLastYear(today) : prev.end,
  };
}

export const INCOME_CATEGORIES = ["Brokerage", "Commission", "Advisory", "Other income"] as const;
export const EXPENSE_CATEGORIES = ["Salaries", "Rent", "Marketing", "Cab", "Vendor payments", "Software", "Office", "Misc"] as const;

/** Payroll cost is the Salaries expense category; disbursed payroll runs post there. */
export const PAYROLL_CATEGORY = "Salaries";

/** Expenses card groups (prototype ticks: Vendors · Salaries · Mktg · Other). */
const EXPENSE_GROUPS: { label: string; tick: string; categories: readonly string[] }[] = [
  { label: "Vendors", tick: "Vendors", categories: ["Vendor payments"] },
  { label: "Salaries", tick: "Salaries", categories: ["Salaries"] },
  { label: "Marketing", tick: "Mktg", categories: ["Marketing"] },
  { label: "Other", tick: "Other", categories: [] },
];

export function expenseGroupOf(category: string): string {
  return (EXPENSE_GROUPS.find((g) => g.categories.includes(category)) ?? EXPENSE_GROUPS[EXPENSE_GROUPS.length - 1]!).label;
}

export function groupExpenses(byCategory: { category: string; paise: number }[]): { label: string; tick: string; paise: number }[] {
  const groups = EXPENSE_GROUPS.map((g) => ({ label: g.label, tick: g.tick, paise: 0 }));
  for (const row of byCategory) groups.find((g) => g.label === expenseGroupOf(row.category))!.paise += row.paise;
  return groups;
}

/** Rounded % change against last year, or null when last year had nothing to compare with. */
export function changePct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** "+14% YoY", "−6% YoY" (true minus sign) or "" without a comparison. */
export function yoyLabel(current: number, previous: number): string {
  const pct = changePct(current, previous);
  if (pct === null) return "";
  return `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}% YoY`;
}

/** `part` as a whole-number percentage of `whole`, or null when `whole` is zero or negative. */
export function sharePct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

export const AGEING_BUCKETS = ["Not yet due", "1–30 days", "31–60 days", "60+ days"] as const;

/** Days an invoice is past its due date (0 when not yet due or no due date). */
export function daysOverdue(dueIso: string | null, todayIso: string): number {
  if (!dueIso || dueIso >= todayIso) return 0;
  return Math.round((Date.parse(todayIso) - Date.parse(dueIso)) / 86_400_000);
}

/** Index into AGEING_BUCKETS. */
export function ageingBucket(dueIso: string | null, todayIso: string): 0 | 1 | 2 | 3 {
  const days = daysOverdue(dueIso, todayIso);
  return days === 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3;
}

/** Spreadsheet cells must never start a formula (=, +, −, @, tab, CR): prefix them with an apostrophe. */
export function safeCellText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
