import "server-only";
import type { CabStatus, CarType } from "@/generated/prisma/enums";
import { addDaysIso, dateToIso, formatDateTimeShort, isoDateIST, isoToDate } from "@/lib/dates";
import { initialsOf } from "../auth/session";
import { companyProfile } from "../company";
import { db } from "../db";
import { can, type SessionUser } from "../policy";

export interface CabRowDto {
  id: string;
  bookedFor: { id: string; name: string; initials: string; role: string };
  clientName: string;
  carType: CarType;
  date: string;
  time: string;
  pickupLocation: string;
  bookedOn: string;
  status: CabStatus;
  canConfirm: boolean;
  canComplete: boolean;
  canCancel: boolean;
}

export interface PersonOption {
  id: string;
  label: string;
}

/** "Partner" for owners without a title, otherwise the person's title. */
const roleLabel = (u: { role: string; title: string | null }) => u.title ?? (u.role === "OWNER" ? "Partner" : u.role === "ADMIN" ? "Admin" : "Team member");

/** Bookings shown on the page: everything upcoming plus the last six weeks, newest first. */
export async function listCabBookings(user: SessionUser, today = isoDateIST()): Promise<CabRowDto[]> {
  const rows = await db.cabBooking.findMany({
    where: { OR: [{ pickupDate: { gte: isoToDate(today) } }, { createdAt: { gte: new Date(Date.now() - 42 * 86_400_000) } }] },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { bookedFor: { select: { id: true, name: true, role: true, title: true } } },
  });
  return rows.map((b) => {
    const open = b.status === "REQUESTED" || b.status === "CONFIRMED";
    const manage = can(user, "update", { type: "cab", bookedForId: b.bookedForId, createdById: b.createdById });
    return {
      id: b.id,
      bookedFor: { id: b.bookedFor.id, name: b.bookedFor.name, initials: initialsOf(b.bookedFor.name), role: roleLabel(b.bookedFor) },
      clientName: b.clientName,
      carType: b.carType,
      date: dateToIso(b.pickupDate),
      time: b.pickupTime,
      pickupLocation: b.pickupLocation,
      bookedOn: formatDateTimeShort(b.createdAt),
      status: b.status,
      canConfirm: manage && b.status === "REQUESTED",
      canComplete: manage && b.status === "CONFIRMED",
      canCancel: open && can(user, "delete", { type: "cab", bookedForId: b.bookedForId, createdById: b.createdById }),
    };
  });
}

export async function cabStats(today = isoDateIST()) {
  const notCancelled = { status: { not: "CANCELLED" as const } };
  const [todayCount, upcoming, all] = await Promise.all([
    db.cabBooking.count({ where: { ...notCancelled, pickupDate: isoToDate(today) } }),
    db.cabBooking.count({ where: { status: { in: ["REQUESTED", "CONFIRMED"] }, pickupDate: { gte: isoToDate(today) } } }),
    db.cabBooking.count({ where: notCancelled }),
  ]);
  return { today: todayCount, upcoming, all };
}

/** Everyone who can be booked for, as "Name · Title". */
export async function bookingPeople(): Promise<PersonOption[]> {
  const users = await db.user.findMany({ where: { active: true, deletedAt: null }, orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true, role: true, title: true } });
  return users.map((u) => ({ id: u.id, label: `${u.name} · ${roleLabel(u)}` }));
}

/** Quick-fill chips: the office, the airport, then the most-used recent pick-up point. */
export async function pickupSuggestions(): Promise<string[]> {
  const office = `Office — ${companyProfile().address.split(",").slice(0, 2).join(",").trim()}`;
  const recent = await db.cabBooking.groupBy({
    by: ["pickupLocation"],
    where: { createdAt: { gte: isoToDate(addDaysIso(isoDateIST(), -90)) } },
    _count: { pickupLocation: true },
    orderBy: { _count: { pickupLocation: "desc" } },
    take: 6,
  });
  const places = [office, "Kempegowda Airport, T2", ...recent.map((r) => r.pickupLocation)];
  return [...new Set(places)].slice(0, 3);
}
