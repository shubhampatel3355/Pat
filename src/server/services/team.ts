import "server-only";
import type { Role } from "@/generated/prisma/enums";
import { dateToIso, fyQuarterOfIso, isoDateIST } from "@/lib/dates";
import { toPaise } from "@/lib/money";
import { initialsOf } from "../auth/session";
import { db } from "../db";
import { can, has, type SessionUser } from "../policy";
import { revenueByUser } from "./revenue";
import { targetsByScope } from "./targets";

export type MemberStatus = "ACTIVE" | "INVITED" | "INACTIVE";

export interface MemberDto {
  id: string;
  name: string;
  initials: string;
  title: string;
  role: Role;
  email: string;
  phone: string;
  partnerId: string | null;
  partnerName: string | null;
  dateOfJoining: string | null;
  ctcAnnualPaise: number | null;
  status: MemberStatus;
  achievedPaise: number;
  targetPaise: number | null;
  canEdit: boolean;
}

export interface TeamSummary {
  members: MemberDto[];
  quarterShort: string;
  counts: { employees: number; admins: number; partners: number };
}

/** Everyone except the partners (owners), with this quarter's attributed revenue against their target. */
export async function teamSummary(user: SessionUser, today = isoDateIST()): Promise<TeamSummary> {
  const q = fyQuarterOfIso(today);
  const [users, owners, revenue, targets] = await Promise.all([
    db.user.findMany({
      where: { deletedAt: null, role: { not: "OWNER" } },
      orderBy: [{ active: "desc" }, { dateOfJoining: "asc" }, { createdAt: "asc" }],
      include: { partner: { select: { name: true } } },
    }),
    db.user.count({ where: { deletedAt: null, role: "OWNER", active: true } }),
    revenueByUser(q.start, q.end),
    targetsByScope("USER", "REVENUE", q.key),
  ]);
  const seeCtc = has(user, "payroll.view_all");
  const members = users.map<MemberDto>((u) => ({
    id: u.id,
    name: u.name,
    initials: initialsOf(u.name),
    title: u.title ?? (u.role === "ADMIN" ? "Admin" : "Team member"),
    role: u.role,
    email: u.email,
    phone: u.phone ?? "",
    partnerId: u.partnerId,
    partnerName: u.partner?.name ?? null,
    dateOfJoining: u.dateOfJoining ? dateToIso(u.dateOfJoining) : null,
    ctcAnnualPaise: seeCtc && u.ctcAnnualPaise !== null ? toPaise(u.ctcAnnualPaise) : null,
    status: !u.active ? "INACTIVE" : u.passwordHash ? "ACTIVE" : "INVITED",
    achievedPaise: revenue.get(u.id) ?? 0,
    targetPaise: targets.get(u.id) ?? null,
    canEdit: can(user, "update", { type: "team", targetRole: u.role, targetId: u.id }),
  }));
  const active = users.filter((u) => u.active);
  return {
    members,
    quarterShort: `Q${q.q}`,
    counts: { employees: active.filter((u) => u.role === "EMPLOYEE").length, admins: active.filter((u) => u.role === "ADMIN").length, partners: owners },
  };
}
