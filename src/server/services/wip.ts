import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { LandlordType, PricingBasis, WipRemark } from "@/generated/prisma/enums";
import { CLOSED_REMARKS } from "@/lib/constants";
import { dateToIso, fyQuarterOfIso, isoDateIST } from "@/lib/dates";
import { toPaise } from "@/lib/money";
import { monthlyRentPaise } from "@/lib/wip";
import { initialsOf } from "../auth/session";
import { db } from "../db";
import { can, has, type SessionUser } from "../policy";
import { wipScope } from "../policy/scopes";
import { getTarget } from "./targets";

export interface BrokerChip {
  userId: string | null;
  name: string;
  initials: string;
}

export interface WipRowDto {
  id: string;
  sl: number;
  tenantName: string;
  initials: string;
  pricingBasis: PricingBasis;
  areaSqft: number | null;
  seats: number | null;
  ratePaise: number;
  monthlyRentPaise: number;
  building: string;
  location: string;
  landlordType: LandlordType;
  landlordName: string;
  estFeesPaise: number;
  closureDate: string;
  remark: WipRemark;
  primary: BrokerChip[];
  secondary: BrokerChip[];
  canEdit: boolean;
  canDelete: boolean;
}

export interface UserOption {
  id: string;
  name: string;
  initials: string;
}

const leadInclude = {
  brokers: { orderBy: [{ role: "asc" as const }, { position: "asc" as const }], include: { user: { select: { id: true, name: true } } } },
} satisfies Prisma.LeadInclude;

type LeadWithBrokers = Prisma.LeadGetPayload<{ include: typeof leadInclude }>;

export function brokerUserIds(lead: { brokers: { userId: string | null }[] }): string[] {
  return lead.brokers.flatMap((b) => (b.userId ? [b.userId] : []));
}

function chip(b: LeadWithBrokers["brokers"][number]): BrokerChip {
  const name = b.user?.name ?? b.externalName ?? "—";
  return { userId: b.userId, name, initials: initialsOf(name) };
}

export async function listWip(user: SessionUser): Promise<WipRowDto[]> {
  const leads = await db.lead.findMany({ where: wipScope(user), orderBy: { serial: "asc" }, include: leadInclude });
  return leads.map((l, i) => {
    const ids = brokerUserIds(l);
    const rate = toPaise(l.ratePaise);
    return {
      id: l.id,
      sl: i + 1,
      tenantName: l.tenantName,
      initials: initialsOf(l.tenantName),
      pricingBasis: l.pricingBasis,
      areaSqft: l.areaSqft,
      seats: l.seats,
      ratePaise: rate,
      monthlyRentPaise: monthlyRentPaise(l.pricingBasis, rate, l.areaSqft, l.seats),
      building: l.building ?? "",
      location: l.location,
      landlordType: l.landlordType,
      landlordName: l.landlordName ?? "",
      estFeesPaise: toPaise(l.estFeesPaise),
      closureDate: dateToIso(l.closureDate),
      remark: l.remark,
      primary: l.brokers.filter((b) => b.role === "PRIMARY").map(chip),
      secondary: l.brokers.filter((b) => b.role === "SECONDARY").map(chip),
      canEdit: can(user, "update", { type: "wip", brokerUserIds: ids }),
      canDelete: can(user, "delete", { type: "wip", brokerUserIds: ids }),
    };
  });
}

export interface WipCardsDto {
  quarterLabel: string;
  targetPaise: number | null;
  currentPaise: number;
  mandates: number;
}

/**
 * Quarter view: fees expected to close this quarter (closure date in the quarter, or overdue and still open),
 * excluding Lost. Employees are measured against their own WIP target; everyone else against the company's.
 */
export function wipCards(rows: WipRowDto[], today = isoDateIST()): Omit<WipCardsDto, "targetPaise"> {
  const q = fyQuarterOfIso(today);
  const inQuarter = rows.filter((r) => {
    if (r.remark === "LOST") return false;
    if (r.closureDate >= q.start && r.closureDate <= q.end) return true;
    return r.closureDate < q.start && !CLOSED_REMARKS.includes(r.remark);
  });
  return { quarterLabel: q.label, currentPaise: inQuarter.reduce((a, r) => a + r.estFeesPaise, 0), mandates: inQuarter.length };
}

export async function wipTarget(user: SessionUser, today = isoDateIST()): Promise<number | null> {
  const q = fyQuarterOfIso(today);
  if (has(user, "wip.view_all")) return getTarget("COMPANY", "company", "WIP_FEES", q.key);
  return getTarget("USER", user.id, "WIP_FEES", q.key);
}

export async function activeUserOptions(): Promise<UserOption[]> {
  const users = await db.user.findMany({ where: { active: true, deletedAt: null }, orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  return users.map((u) => ({ id: u.id, name: u.name, initials: initialsOf(u.name) }));
}

export { leadInclude };
