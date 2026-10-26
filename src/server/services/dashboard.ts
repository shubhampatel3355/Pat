import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { WipRemark } from "@/generated/prisma/enums";
import { CAR_TYPES, CLOSED_REMARKS, WIP_REMARK, WIP_REMARKS } from "@/lib/constants";
import { currentFy, dateToIso, financialYear, fyQuarterOfIso, fyToDateLabel, isoDateIST, isoToDate, istToInstant, sameDayLastYear } from "@/lib/dates";
import { toPaise } from "@/lib/money";
import { db } from "../db";
import { has, isAdminOrOwner, type SessionUser } from "../policy";
import type { ViewState } from "../view";
import { partnerTeamIds } from "../view";
import { incentiveFor } from "./incentive";
import { payrollEmployees } from "./payroll";
import { companyRevenue, revenueByFy, teamRevenue } from "./revenue";
import { getTarget } from "./targets";
import { listWip, wipCards } from "./wip";

export interface TodoDto {
  id: string;
  text: string;
  dueDate: string | null;
  dueTime: string | null;
  important: boolean;
  remind: boolean;
  note: string;
  done: boolean;
}

export interface AchievementDto {
  id: string;
  kind: "DEAL_CLOSED" | "TARGET_REACHED" | "MILESTONE";
  title: string;
  meta: string;
  valuePaise: number | null;
}

export interface PipelineStage {
  remark: WipRemark;
  label: string;
  color: string;
  paise: number;
  count: number;
}

export interface EmployeeDayItem {
  id: string;
  kind: "LEAD" | "CAB";
  title: string;
  sub: string;
  date: string;
  time: string | null;
  href: string;
}

export interface DashboardData {
  mode: "company" | "partner" | "employee";
  today: string;
  viewLabel: string;
  /** `note` follows the amount ("achieved year to date"); `scope` names the target in achievements. */
  target: { label: string; amountPaise: number | null; achievedPaise: number; note: string; scope: string };
  revenue: {
    ytdLabel: string;
    ytdPaise: number;
    yoyPct: number | null;
    fyLabel: string;
    projectedPaise: number;
    previous: { key: string; label: string; valuePaise: number }[];
  } | null;
  pipeline: { totalPaise: number; open: number; stages: PipelineStage[] } | null;
  todos: TodoDto[];
  achievements: AchievementDto[];
  canOpenFinance: boolean;
  /** The employee dashboard's cards (prototype "Employee View"). */
  employee?: {
    wip: { feesInPlayPaise: number; mandates: number; rows: { id: string; tenantName: string; building: string; feePaise: number; remark: WipRemark }[] };
    day: EmployeeDayItem[];
    pay: { earnedPaise: number; expectedPaise: number; ctcAnnualPaise: number | null; dateOfJoining: string | null; latestPayslip: { url: string; label: string } | null };
  };
}

function monthStart(today: string) {
  return `${today.slice(0, 8)}01`;
}

async function pipelineFor(where: Prisma.LeadWhereInput) {
  const leads = await db.lead.findMany({ where, select: { remark: true, estFeesPaise: true } });
  const open = leads.filter((l) => !CLOSED_REMARKS.includes(l.remark));
  const stages = WIP_REMARKS.filter((r) => !CLOSED_REMARKS.includes(r.value)).map((r) => {
    const rows = open.filter((l) => l.remark === r.value);
    return { remark: r.value, label: r.label, color: r.color, count: rows.length, paise: rows.reduce((a, l) => a + toPaise(l.estFeesPaise), 0) };
  });
  return { totalPaise: stages.reduce((a, s) => a + s.paise, 0), open: open.length, stages };
}

async function todosOf(userId: string): Promise<TodoDto[]> {
  const rows = await db.todo.findMany({ where: { userId }, orderBy: [{ done: "asc" }, { dueDate: "asc" }, { dueTime: "asc" }, { createdAt: "desc" }], take: 100 });
  return rows.map((t) => ({ id: t.id, text: t.text, dueDate: t.dueDate ? dateToIso(t.dueDate) : null, dueTime: t.dueTime, important: t.important, remind: t.remind, note: t.note ?? "", done: t.done }));
}

async function achievementsSince(fromIso: string, userIds: string[] | null): Promise<AchievementDto[]> {
  const rows = await db.achievement.findMany({
    where: { createdAt: { gte: istToInstant(fromIso) }, ...(userIds ? { userId: { in: userIds } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return rows.map((a) => ({ id: a.id, kind: a.kind, title: a.title, meta: a.meta ?? "", valuePaise: a.valuePaise === null ? null : toPaise(a.valuePaise) }));
}

/** Year-to-date, same period last year, projection and earlier years — company-wide or for a team. */
async function revenueBlock(today: string, teamIds: string[] | null) {
  const fy = currentFy();
  const ytd = teamIds ? await teamRevenue(fy.start, today, teamIds) : await companyRevenue(fy.start, today);
  const lastYearToday = sameDayLastYear(today);
  const prevFy = financialYear(fy.startYear - 1);
  const lastYtd = teamIds ? await teamRevenue(prevFy.start, lastYearToday, teamIds) : await companyRevenue(prevFy.start, lastYearToday);
  const elapsed = Math.max(1, (Date.parse(today) - Date.parse(fy.start)) / 86_400_000 + 1);
  const days = (Date.parse(fy.end) - Date.parse(fy.start)) / 86_400_000 + 1;
  const byFy = await revenueByFy(teamIds ?? undefined);
  const previous = [1, 2, 3, 4].map((back) => {
    const f = financialYear(fy.startYear - back);
    return { key: f.key, label: f.label + (back === 1 ? " (last)" : ""), valuePaise: byFy.get(f.startYear) ?? 0 };
  });
  return {
    ytdLabel: `YTD · ${fyToDateLabel(fy, today)}`,
    ytdPaise: ytd,
    yoyPct: lastYtd > 0 ? Math.round(((ytd - lastYtd) / lastYtd) * 100) : null,
    fyLabel: `Current ${fy.label}`,
    projectedPaise: Math.round((ytd / elapsed) * days),
    previous,
  };
}

export async function dashboardData(user: SessionUser, view: ViewState): Promise<DashboardData> {
  const today = isoDateIST();
  const fy = currentFy();
  const todos = await todosOf(user.id);

  // Employees: the prototype's Employee View — own quarter target against own WIP, My WIP, My day, incentive.
  if (!isAdminOrOwner(user)) {
    const q = fyQuarterOfIso(today);
    const [all, quarterTarget, cab, achievements, incentive, payroll] = await Promise.all([
      listWip(user),
      getTarget("USER", user.id, "WIP_FEES", q.key),
      db.cabBooking.findFirst({
        where: { bookedForId: user.id, status: { in: ["REQUESTED", "CONFIRMED"] }, pickupDate: { gte: isoToDate(today) } },
        orderBy: [{ pickupDate: "asc" }, { pickupTime: "asc" }],
      }),
      achievementsSince(monthStart(today), [user.id]),
      incentiveFor(user.id, today),
      payrollEmployees(user),
    ]);
    // Their own rows even if they may see everyone's.
    const mine = all.filter((r) => [...r.primary, ...r.secondary].some((b) => b.userId === user.id));
    const open = mine.filter((r) => !CLOSED_REMARKS.includes(r.remark));
    const next = open.filter((r) => r.remark !== "INVOICE_RAISED" && r.remark !== "ON_HOLD").sort((a, b) => a.closureDate.localeCompare(b.closureDate));
    const me = payroll.find((p) => p.id === user.id);
    const latest = me?.statements.MONTHLY[0];
    const day: EmployeeDayItem[] = next.slice(0, 3).map((r) => ({
      id: r.id,
      kind: "LEAD",
      title: r.tenantName,
      sub: `${WIP_REMARK[r.remark].label}${r.building ? ` · ${r.building}` : ""}`,
      date: r.closureDate,
      time: null,
      href: `/wip?focus=${r.id}`,
    }));
    if (cab) {
      day.push({
        id: cab.id,
        kind: "CAB",
        title: `${CAR_TYPES.find((t) => t.value === cab.carType)?.label ?? "Cab"} · ${cab.clientName}`,
        sub: `Cab · ${cab.pickupLocation}`,
        date: dateToIso(cab.pickupDate),
        time: cab.pickupTime,
        href: "/vehicles",
      });
    }
    return {
      mode: "employee",
      today,
      viewLabel: `Employee View · ${user.name}`,
      target: { label: `${q.label} · ${user.firstName}`, amountPaise: quarterTarget, achievedPaise: wipCards(mine, today).currentPaise, note: "in WIP this quarter", scope: "this quarter's target" },
      revenue: null,
      pipeline: null,
      todos,
      achievements,
      canOpenFinance: false,
      employee: {
        wip: {
          feesInPlayPaise: open.reduce((a, r) => a + r.estFeesPaise, 0),
          mandates: open.length,
          rows: open.slice(0, 4).map((r) => ({ id: r.id, tenantName: r.tenantName, building: r.building, feePaise: r.estFeesPaise, remark: r.remark })),
        },
        day,
        pay: {
          earnedPaise: incentive.earnedPaise,
          expectedPaise: incentive.expectedPaise,
          ctcAnnualPaise: me?.ctcAnnualPaise ?? null,
          dateOfJoining: me?.dateOfJoining ?? null,
          latestPayslip: latest ? { url: `/api/payslips/${user.id}/MONTHLY/${encodeURIComponent(latest.key)}`, label: latest.label } : null,
        },
      },
    };
  }

  const partner = view.partner;
  const teamIds = partner ? await partnerTeamIds(partner.id) : null;
  const [targetAmount, revenue, pipeline, achievements] = await Promise.all([
    partner ? getTarget("PARTNER", partner.id, "REVENUE", fy.key) : getTarget("COMPANY", "company", "REVENUE", fy.key),
    revenueBlock(today, teamIds),
    pipelineFor(teamIds ? { deletedAt: null, brokers: { some: { role: "PRIMARY", userId: { in: teamIds } } } } : { deletedAt: null }),
    achievementsSince(monthStart(today), teamIds),
  ]);
  return {
    mode: partner ? "partner" : "company",
    today,
    viewLabel: partner ? `Partner View · ${partner.name}` : "Company View",
    target: { label: partner ? `${fy.label} · ${partner.name.split(" ")[0]}` : fy.label, amountPaise: targetAmount, achievedPaise: revenue.ytdPaise, note: "achieved year to date", scope: "the annual target" },
    revenue,
    pipeline,
    todos,
    achievements,
    canOpenFinance: has(user, "finance.view"),
  };
}
