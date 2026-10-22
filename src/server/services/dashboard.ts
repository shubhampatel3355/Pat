import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CabStatus, CarType, FollowUpType, WipRemark } from "@/generated/prisma/enums";
import { CLOSED_REMARKS, WIP_REMARKS } from "@/lib/constants";
import { addDaysIso, currentFy, dateToIso, financialYear, fyToDateLabel, isoDateIST, isoToDate, istToInstant, timeIST } from "@/lib/dates";
import { toPaise } from "@/lib/money";
import { db } from "../db";
import { has, isAdminOrOwner, type SessionUser } from "../policy";
import { wipScope } from "../policy/scopes";
import type { ViewState } from "../view";
import { partnerTeamIds } from "../view";
import { companyRevenue, revenueByFy, revenueByUser, teamRevenue } from "./revenue";
import { getTarget, targetsByScope } from "./targets";

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

export interface DashboardData {
  mode: "company" | "partner" | "employee";
  today: string;
  viewLabel: string;
  target: { label: string; amountPaise: number | null; achievedPaise: number };
  revenue: {
    ytdLabel: string;
    ytdPaise: number;
    yoyPct: number | null;
    fyLabel: string;
    projectedPaise: number;
    previous: { key: string; label: string; valuePaise: number }[];
  } | null;
  pipeline: { totalPaise: number; open: number; stages: PipelineStage[] };
  todos: TodoDto[];
  achievements: AchievementDto[];
  canOpenFinance: boolean;
  employee?: {
    followUps: { id: string; title: string; type: FollowUpType | "TASK"; time: string | null; href: string }[];
    cabs: { id: string; car: CarType; client: string; date: string; time: string; pickup: string; status: CabStatus }[];
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
  const lastYearToday = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
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

  // Employees: a personal dashboard (not designed in the prototype — flagged for design review).
  if (!isAdminOrOwner(user)) {
    const [fyTarget, quarterTargets, own, pipeline, followUps, tasks, cabs, achievements] = await Promise.all([
      getTarget("USER", user.id, "REVENUE", fy.key),
      Promise.all([1, 2, 3, 4].map((q) => targetsByScope("USER", "REVENUE", `${fy.key}-Q${q}`))),
      revenueByUser(fy.start, today, [user.id]),
      pipelineFor(wipScope(user)),
      db.followUp.findMany({
        where: { ownerId: user.id, deletedAt: null, completedAt: null, dueAt: { gte: istToInstant(today), lt: istToInstant(addDaysIso(today, 1)) } },
        orderBy: { dueAt: "asc" },
        take: 8,
      }),
      db.task.findMany({
        where: { assigneeId: user.id, deletedAt: null, status: { not: "DONE" }, dueAt: { lt: istToInstant(addDaysIso(today, 1)) } },
        orderBy: { dueAt: "asc" },
        take: 8,
      }),
      db.cabBooking.findMany({
        where: { bookedForId: user.id, status: { in: ["REQUESTED", "CONFIRMED"] }, pickupDate: { gte: isoToDate(today) } },
        orderBy: [{ pickupDate: "asc" }, { pickupTime: "asc" }],
        take: 5,
      }),
      achievementsSince(monthStart(today), [user.id]),
    ]);
    const summedQuarters = quarterTargets.reduce((a, m) => a + (m.get(user.id) ?? 0), 0);
    return {
      mode: "employee",
      today,
      viewLabel: "My dashboard",
      target: { label: `${fy.label} · ${user.firstName}`, amountPaise: fyTarget ?? (summedQuarters || null), achievedPaise: own.get(user.id) ?? 0 },
      revenue: null,
      pipeline,
      todos,
      achievements,
      canOpenFinance: false,
      employee: {
        followUps: [
          ...followUps.map((f) => ({ id: f.id, title: `${f.contactName}${f.note ? ` — ${f.note}` : ""}`, type: f.type, time: timeIST(f.dueAt), href: "/follow-ups" })),
          ...tasks.map((t) => ({ id: t.id, title: t.title, type: "TASK" as const, time: t.dueAt ? timeIST(t.dueAt) : null, href: `/follow-ups?task=${t.id}` })),
        ],
        cabs: cabs.map((c) => ({ id: c.id, car: c.carType, client: c.clientName, date: dateToIso(c.pickupDate), time: c.pickupTime, pickup: c.pickupLocation, status: c.status })),
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
    target: { label: partner ? `${fy.label} · ${partner.name.split(" ")[0]}` : fy.label, amountPaise: targetAmount, achievedPaise: revenue.ytdPaise },
    revenue,
    pipeline,
    todos,
    achievements,
    canOpenFinance: has(user, "finance.view"),
  };
}
