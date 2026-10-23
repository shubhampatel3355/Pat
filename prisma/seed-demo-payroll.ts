/**
 * DEV / DEMO ONLY — monthly payroll from the start of the previous financial year: disbursed runs with
 * payslips (each posting its Salaries expense to the ledger) and the current month open for review,
 * with the prototype's October commissions and incentives. Skipped when any run exists.
 */
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { dateToIso, financialYear, fyOfIso, isoToDate, istToInstant } from "../src/lib/dates";
import { computePayslip, daysPaidFor, longMonthLabel, monthEnd } from "../src/lib/payroll";
import type { DemoIds } from "./seed-demo-ops";

type Key = keyof DemoIds;
const RUPEE = 100;

/** Prototype INCENT (monthly incentives) — paid at quarter ends in the history, monthly in the open run. */
const INCENTIVE: Partial<Record<Key, number>> = { NS: 25000, KI: 15000, SK: 10000, RV: 5000, DN: 5000, IP: 8000 };
/** The prototype's October commissions. */
const COMMISSION_NOW: Partial<Record<Key, number>> = { NS: 92000, KI: 56000 };
const SALES: Key[] = ["NS", "KI", "SK", "RV", "DN", "IP"];

const nextPeriod = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return m === 12 ? `${y! + 1}-01` : `${y}-${String(m! + 1).padStart(2, "0")}`;
};

export async function seedDemoPayroll(prisma: PrismaClient, ids: DemoIds, today: string, log: (m: string) => void) {
  if (await prisma.payrollRun.count()) return;
  const keyOf = new Map(Object.entries(ids).map(([k, id]) => [id, k as Key]));
  const people = await prisma.user.findMany({ where: { active: true, deletedAt: null, role: { not: "OWNER" }, ctcAnnualPaise: { gt: 0 } }, select: { id: true, ctcAnnualPaise: true, dateOfJoining: true } });
  const current = today.slice(0, 7);
  const firstFy = financialYear(fyOfIso(today).startYear - 1);
  let runs = 0;

  for (let period = firstFy.start.slice(0, 7), i = 0; period <= current; period = nextPeriod(period), i++) {
    const open = period === current;
    const quarterEnd = ["03", "06", "09", "12"].includes(period.slice(5));
    // Last year's salaries were about 11 % lower.
    const factor = period < fyOfIso(today).start.slice(0, 7) ? 0.89 : 1;
    const payDate = monthEnd(period);
    const opened = open ? (`${period}-06` <= today ? `${period}-06` : today) : `${period}-25`;

    const run = await prisma.payrollRun.create({
      data: {
        period,
        status: open ? "REVIEW" : "DISBURSED",
        payDate: isoToDate(payDate),
        createdById: ids.AM,
        approvedById: open ? null : ids.PM,
        approvedAt: open ? null : istToInstant(`${period}-28`, "12:00"),
        disbursedById: open ? null : ids.AM,
        disbursedAt: open ? null : istToInstant(payDate, "11:00"),
        createdAt: istToInstant(opened, "10:00"),
      },
    });

    let gross = 0;
    let count = 0;
    for (const p of people) {
      const key = keyOf.get(p.id);
      const daysPaid = daysPaidFor(period, p.dateOfJoining ? dateToIso(p.dateOfJoining) : null);
      if (!daysPaid) continue;
      const sales = key ? SALES.includes(key) : false;
      const commission = open ? (key ? (COMMISSION_NOW[key] ?? 0) : 0) : sales && (i + SALES.indexOf(key!)) % 4 === 0 ? (30000 + ((i * 7919 + SALES.indexOf(key!) * 104729) % 7) * 10000) : 0;
      const incentive = key && INCENTIVE[key] && (open || quarterEnd) ? INCENTIVE[key]! : 0;
      const slip = computePayslip({ period, ctcAnnualPaise: Math.round(Number(p.ctcAnnualPaise) * factor), daysPaid, commission: commission * RUPEE, incentive: incentive * RUPEE });
      const { gross: g, deductions, net, ...components } = slip;
      await prisma.payslip.create({
        data: { runId: run.id, userId: p.id, period, periodType: "MONTHLY", grossPaise: BigInt(g), deductionsPaise: BigInt(deductions), netPaise: BigInt(net), components: components as unknown as Prisma.InputJsonValue },
      });
      gross += g;
      count++;
    }

    if (!open) {
      await prisma.ledgerEntry.create({
        data: { type: "EXPENSE", category: "Salaries", description: `Salaries — ${longMonthLabel(period)} payroll`, party: `${count} employees`, mode: "NEFT", amountPaise: BigInt(gross), entryDate: isoToDate(payDate), payrollRunId: run.id, createdById: ids.AM, createdAt: istToInstant(payDate, "11:00") },
      });
    }
    runs++;
  }
  log(`Inserted ${runs} payroll runs (the latest open for review)`);
}
