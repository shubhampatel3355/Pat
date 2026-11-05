import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { PayrollRunStatus } from "@/generated/prisma/enums";
import { dateToIso, isoDateIST } from "@/lib/dates";
import { toPaise } from "@/lib/money";
import { computePayslip, daysPaidFor, longMonthLabel, monthEnd, statementOptions, statementPeriod, sumComponents, type PayslipComponents, type PayslipTotals, type StatementPeriod, type StatementType } from "@/lib/payroll";
import { initialsOf } from "../auth/session";
import { db, type Tx } from "../db";
import { has, type SessionUser } from "../policy";

/** Partners draw from the LLP, not through payroll. */
const ON_PAYROLL: Prisma.UserWhereInput = { active: true, deletedAt: null, role: { not: "OWNER" } };

interface Person {
  id: string;
  name: string;
  initials: string;
  title: string;
}

const person = (u: { id: string; name: string; title: string | null }): Person => ({ id: u.id, name: u.name, initials: initialsOf(u.name), title: u.title ?? "Team member" });

export interface PayslipRowDto {
  id: string;
  user: Person;
  components: PayslipComponents;
  totals: PayslipTotals;
  onHold: boolean;
}

export interface RunDto {
  id: string;
  period: string;
  label: string;
  status: PayrollRunStatus;
  payDate: string;
  openedOn: string;
  approved: { on: string; by: string } | null;
  disbursed: { on: string; by: string } | null;
  payslips: PayslipRowDto[];
  totals: { net: number; commission: number; deductions: number; live: number; held: number };
}

export interface PayrollEmployeeDto extends Person {
  dateOfJoining: string | null;
  ctcAnnualPaise: number | null;
  statements: Record<StatementType, { key: string; label: string }[]>;
}

/** Stored JSON → components (older rows may miss newer keys). */
export function componentsOf(json: Prisma.JsonValue): PayslipComponents {
  const c = (json ?? {}) as Partial<PayslipComponents>;
  const n = (v: unknown) => (typeof v === "number" ? v : 0);
  return {
    basic: n(c.basic), hra: n(c.hra), special: n(c.special), commission: n(c.commission), incentive: n(c.incentive),
    pf: n(c.pf), pt: n(c.pt), tds: n(c.tds), other: n(c.other), daysInMonth: n(c.daysInMonth), daysPaid: n(c.daysPaid),
    tdsOverridden: c.tdsOverridden || undefined, note: c.note || undefined,
  };
}

const runInclude = {
  payslips: { include: { user: { select: { id: true, name: true, title: true } } }, orderBy: { user: { name: "asc" as const } } },
  approvedBy: { select: { name: true } },
  disbursedBy: { select: { name: true } },
} satisfies Prisma.PayrollRunInclude;

function toRunDto(run: Prisma.PayrollRunGetPayload<{ include: typeof runInclude }>): RunDto {
  const payslips = run.payslips.map((p) => ({
    id: p.id,
    user: person(p.user),
    components: componentsOf(p.components),
    totals: { gross: toPaise(p.grossPaise), deductions: toPaise(p.deductionsPaise), net: toPaise(p.netPaise) },
    onHold: p.onHold,
  }));
  const live = payslips.filter((p) => !p.onHold);
  return {
    id: run.id,
    period: run.period,
    label: longMonthLabel(run.period),
    status: run.status,
    payDate: dateToIso(run.payDate),
    openedOn: isoDateIST(run.createdAt),
    approved: run.approvedAt ? { on: isoDateIST(run.approvedAt), by: run.approvedBy?.name ?? "" } : null,
    disbursed: run.disbursedAt ? { on: isoDateIST(run.disbursedAt), by: run.disbursedBy?.name ?? "" } : null,
    payslips,
    totals: {
      net: live.reduce((a, p) => a + p.totals.net, 0),
      commission: live.reduce((a, p) => a + p.components.commission, 0),
      deductions: live.reduce((a, p) => a + p.totals.deductions, 0),
      live: live.length,
      held: payslips.length - live.length,
    },
  };
}

export async function latestRun(): Promise<RunDto | null> {
  const run = await db.payrollRun.findFirst({ orderBy: { period: "desc" }, include: runInclude });
  return run ? toRunDto(run) : null;
}

/**
 * Creates or refreshes the payslips of a run from current CTCs. Reviewer inputs (commission, incentive,
 * other deductions, TDS overrides, holds, notes) on existing payslips are kept.
 */
export async function generatePayslips(tx: Tx, runId: string, period: string): Promise<number> {
  // One connection per transaction: queries run one after another.
  const users = await tx.user.findMany({ where: { ...ON_PAYROLL, ctcAnnualPaise: { gt: 0 } }, select: { id: true, ctcAnnualPaise: true, dateOfJoining: true } });
  const existing = await tx.payslip.findMany({ where: { runId } });
  let count = 0;
  for (const u of users) {
    const joined = u.dateOfJoining ? dateToIso(u.dateOfJoining) : null;
    const daysPaid = daysPaidFor(period, joined);
    if (daysPaid === 0) continue;
    const prev = existing.find((p) => p.userId === u.id);
    const kept = prev ? componentsOf(prev.components) : null;
    const slip = computePayslip({
      period,
      ctcAnnualPaise: toPaise(u.ctcAnnualPaise),
      daysPaid,
      commission: kept?.commission,
      incentive: kept?.incentive,
      other: kept?.other,
      tdsOverride: kept?.tdsOverridden ? kept.tds : null,
      note: kept?.note,
    });
    const { gross, deductions, net, ...components } = slip;
    const data = { grossPaise: BigInt(gross), deductionsPaise: BigInt(deductions), netPaise: BigInt(net), components: components as unknown as Prisma.InputJsonValue };
    if (prev) await tx.payslip.update({ where: { id: prev.id }, data });
    else await tx.payslip.create({ data: { ...data, runId, userId: u.id, period, periodType: "MONTHLY" } });
    count++;
  }
  return count;
}

/** The Payroll table: everyone on payroll for managers, only themselves for others. */
export async function payrollEmployees(user: SessionUser): Promise<PayrollEmployeeDto[]> {
  const all = has(user, "payroll.view_all");
  const users = await db.user.findMany({
    where: all ? ON_PAYROLL : { id: user.id },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, title: true, dateOfJoining: true, ctcAnnualPaise: true },
  });
  const paid = await db.payslip.findMany({
    where: { userId: { in: users.map((u) => u.id) }, onHold: false, run: { status: "DISBURSED" } },
    select: { userId: true, period: true },
  });
  return users.map((u) => {
    const months = paid.filter((p) => p.userId === u.id).map((p) => p.period);
    return {
      ...person(u),
      dateOfJoining: u.dateOfJoining ? dateToIso(u.dateOfJoining) : null,
      ctcAnnualPaise: u.ctcAnnualPaise === null ? null : toPaise(u.ctcAnnualPaise),
      statements: { MONTHLY: statementOptions("MONTHLY", months), QUARTERLY: statementOptions("QUARTERLY", months), YEARLY: statementOptions("YEARLY", months) },
    };
  });
}

interface Statement {
  period: StatementPeriod;
  user: Person & { dateOfJoining: string | null; email: string };
  months: string[];
  components: PayslipComponents & PayslipTotals;
  payDate: string | null;
  /** The single payslip behind a monthly statement (its PDF is cached). */
  payslipId: string | null;
}

/** Disbursed, unheld payslips of one person over a month, quarter or financial year. */
export async function statementFor(userId: string, type: StatementType, key: string): Promise<Statement | null> {
  const period = statementPeriod(type, key);
  if (!period) return null;
  const [user, slips] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, title: true, email: true, dateOfJoining: true } }),
    db.payslip.findMany({ where: { userId, period: { in: period.months }, onHold: false, run: { status: "DISBURSED" } }, include: { run: { select: { payDate: true } } }, orderBy: { period: "asc" } }),
  ]);
  if (!user || !slips.length) return null;
  const last = slips[slips.length - 1]!;
  return {
    period,
    user: { ...person(user), email: user.email, dateOfJoining: user.dateOfJoining ? dateToIso(user.dateOfJoining) : null },
    months: slips.map((s) => s.period),
    components: sumComponents(slips.map((s) => componentsOf(s.components))),
    payDate: dateToIso(last.run.payDate),
    payslipId: type === "MONTHLY" ? last.id : null,
  };
}

/** Month a new run can be opened for: the month after the latest run, or the current month when there is none. */
export async function nextRunPeriod(today = isoDateIST()): Promise<{ period: string; payDate: string } | null> {
  const latest = await db.payrollRun.findFirst({ orderBy: { period: "desc" }, select: { period: true, status: true } });
  const current = today.slice(0, 7);
  let period = current;
  if (latest) {
    if (latest.status !== "DISBURSED") return null;
    const [y, m] = latest.period.split("-").map(Number);
    period = m === 12 ? `${y! + 1}-01` : `${y}-${String(m! + 1).padStart(2, "0")}`;
    if (period > current) return null;
  }
  return { period, payDate: monthEnd(period) };
}
