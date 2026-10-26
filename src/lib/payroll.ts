import { financialYear, fyMonths, fyOfIso, quarterBounds, type FinancialYear } from "./dates";

/**
 * Payroll arithmetic (all amounts in paise). The prototype's structure: CTC is the gross fixed pay,
 * split Basic 50 % · HRA 20 % · Special allowance 30 %; commission and incentives are added per run.
 * Deductions: employee PF 12 % of basic, Karnataka professional tax, and a TDS estimate (10 % of gross
 * above ₹ 50,000 a month) that reviewers can override; any other deduction is entered by hand.
 */

export const PF_RATE = 0.12;
const TDS_RATE = 0.1;
const TDS_FREE_PAISE = 50_000_00;
/** Karnataka: ₹ 200 a month on salaries of ₹ 25,000 or more (₹ 300 in February, ₹ 2,500 a year). */
const PT_THRESHOLD_PAISE = 25_000_00;

export interface PayslipComponents {
  basic: number;
  hra: number;
  special: number;
  commission: number;
  incentive: number;
  pf: number;
  pt: number;
  tds: number;
  other: number;
  daysInMonth: number;
  daysPaid: number;
  /** Set when a reviewer typed the TDS instead of using the estimate. */
  tdsOverridden?: boolean;
  note?: string;
}

export interface PayslipTotals {
  gross: number;
  deductions: number;
  net: number;
}

export function fixedSplit(monthlyPaise: number) {
  const basic = Math.round(monthlyPaise * 0.5);
  const hra = Math.round(monthlyPaise * 0.2);
  return { basic, hra, special: monthlyPaise - basic - hra };
}

export function professionalTax(grossPaise: number, period: string): number {
  if (grossPaise < PT_THRESHOLD_PAISE) return 0;
  return period.endsWith("-02") ? 300_00 : 200_00;
}

export function tdsEstimate(grossPaise: number): number {
  return Math.round(Math.max(0, grossPaise - TDS_FREE_PAISE) * TDS_RATE);
}

export function totalsOf(c: Pick<PayslipComponents, "basic" | "hra" | "special" | "commission" | "incentive" | "pf" | "pt" | "tds" | "other">): PayslipTotals {
  const gross = c.basic + c.hra + c.special + c.commission + c.incentive;
  const deductions = c.pf + c.pt + c.tds + c.other;
  return { gross, deductions, net: gross - deductions };
}

/** Days in a "YYYY-MM" month. */
export function daysInMonth(period: string): number {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

export const monthStart = (period: string) => `${period}-01`;
export const monthEnd = (period: string) => `${period}-${String(daysInMonth(period)).padStart(2, "0")}`;

/** Days of the month on the payroll: from the joining date (if it falls inside the month) to month end. */
export function daysPaidFor(period: string, joinedIso: string | null): number {
  const total = daysInMonth(period);
  if (!joinedIso || joinedIso < monthStart(period)) return total;
  if (joinedIso > monthEnd(period)) return 0;
  return total - Number(joinedIso.slice(8)) + 1;
}

/**
 * A month's payslip from annual CTC and the reviewer's inputs. Fixed pay is prorated for part months;
 * PF, PT and (unless overridden) TDS follow from the result.
 */
export function computePayslip(input: {
  period: string;
  ctcAnnualPaise: number;
  daysPaid: number;
  commission?: number;
  incentive?: number;
  other?: number;
  tdsOverride?: number | null;
  note?: string;
}): PayslipComponents & PayslipTotals {
  const days = daysInMonth(input.period);
  const factor = Math.max(0, Math.min(days, input.daysPaid)) / days;
  const split = fixedSplit(Math.round(input.ctcAnnualPaise / 12));
  const basic = Math.round(split.basic * factor);
  const hra = Math.round(split.hra * factor);
  const special = Math.round(split.special * factor);
  const commission = input.commission ?? 0;
  const incentive = input.incentive ?? 0;
  const gross = basic + hra + special + commission + incentive;
  const pf = Math.round(basic * PF_RATE);
  const pt = professionalTax(gross, input.period);
  const overridden = input.tdsOverride !== undefined && input.tdsOverride !== null;
  const tds = overridden ? input.tdsOverride! : tdsEstimate(gross);
  const other = input.other ?? 0;
  const c: PayslipComponents = { basic, hra, special, commission, incentive, pf, pt, tds, other, daysInMonth: days, daysPaid: Math.max(0, Math.min(days, input.daysPaid)), tdsOverridden: overridden || undefined, note: input.note || undefined };
  return { ...c, ...totalsOf(c) };
}

/** Sum of several months (quarterly / yearly statements). */
export function sumComponents(list: PayslipComponents[]): PayslipComponents & PayslipTotals {
  const keys = ["basic", "hra", "special", "commission", "incentive", "pf", "pt", "tds", "other", "daysInMonth", "daysPaid"] as const;
  const c = Object.fromEntries(keys.map((k) => [k, list.reduce((a, x) => a + (x[k] ?? 0), 0)])) as unknown as PayslipComponents;
  return { ...c, ...totalsOf(c) };
}

// ── Periods ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10" → "October 2026" */
export function longMonthLabel(period: string): string {
  return `${MONTH_NAMES[Number(period.slice(5)) - 1]} ${period.slice(0, 4)}`;
}

/** "2026-10" → "Oct 2026" */
export function shortMonthLabel(period: string): string {
  return `${MONTH_NAMES[Number(period.slice(5)) - 1]!.slice(0, 3)} ${period.slice(0, 4)}`;
}

export const periodOfIso = (iso: string) => iso.slice(0, 7);

export type StatementType = "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface StatementPeriod {
  type: StatementType;
  /** "2026-10", "FY2026-27-Q2" or "FY2026-27". */
  key: string;
  label: string;
  months: string[];
}

const fyFromKey = (key: string): FinancialYear | null => {
  const m = /^FY(\d{4})-\d{2}/.exec(key);
  return m ? financialYear(Number(m[1])) : null;
};

/** Validates a statement key and expands it to its months; null when it isn't a real period. */
export function statementPeriod(type: StatementType, key: string): StatementPeriod | null {
  if (type === "MONTHLY") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return null;
    return { type, key, label: longMonthLabel(key), months: [key] };
  }
  const fy = fyFromKey(key);
  if (!fy) return null;
  if (type === "YEARLY") return key === fy.key ? { type, key, label: fy.label, months: fyMonths(fy) } : null;
  const q = /-Q([1-4])$/.exec(key);
  if (!q || key !== `${fy.key}-Q${q[1]}`) return null;
  const b = quarterBounds(fy, Number(q[1]) as 1 | 2 | 3 | 4);
  const months = fyMonths(fy).slice((Number(q[1]) - 1) * 3, Number(q[1]) * 3);
  return { type, key, label: `${b.label} · ${b.months}`, months };
}

/** Statement choices for a set of paid months, newest first. */
export function statementOptions(type: StatementType, paidMonths: string[]): { key: string; label: string }[] {
  const months = [...new Set(paidMonths)].sort().reverse();
  if (type === "MONTHLY") return months.map((m) => ({ key: m, label: shortMonthLabel(m) }));
  const keys = new Set<string>();
  for (const m of months) {
    const fy = fyOfIso(monthStart(m));
    if (type === "YEARLY") keys.add(fy.key);
    else keys.add(`${fy.key}-Q${Math.floor(fyMonths(fy).indexOf(m) / 3) + 1}`);
  }
  return [...keys].map((key) => {
    const p = statementPeriod(type, key)!;
    return { key, label: p.label };
  });
}
