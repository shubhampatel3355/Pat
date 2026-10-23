import "server-only";
import type { LeadTemperature, MeetingMode, MeetingType } from "@/generated/prisma/enums";
import { dateToIso } from "@/lib/dates";
import { formatMobile } from "@/lib/schemas/common";
import { initialsOf } from "../auth/session";
import { decryptOptional } from "../crypto";
import { db } from "../db";
import { can, type SessionUser } from "../policy";
import { bdScope } from "../policy/scopes";

interface Person {
  id: string;
  name: string;
  initials: string;
}

export interface BdRowDto {
  id: string;
  primary: Person;
  secondary: Person | null;
  date: string;
  tenantName: string;
  contactName: string;
  designation: string | null;
  /** Null when the viewer may not see client contact info — enforced here, not just hidden in the UI. */
  contact: { phone: string | null; email: string | null } | null;
  meetingType: MeetingType;
  temperature: LeadTemperature;
  mode: MeetingMode;
  comments: string;
  canEdit: boolean;
  canDelete: boolean;
}

/** Newest meetings first; older history stays in the database and the audit log. */
const MAX_ROWS = 500;

const person = (u: { id: string; name: string }): Person => ({ id: u.id, name: u.name, initials: initialsOf(u.name) });

/** "+91 98450 22114" for Indian mobiles, digits as stored otherwise. */
export function displayPhone(digits: string | null): string | null {
  if (!digits) return null;
  return /^\d{10}$/.test(digits) ? `+91 ${formatMobile(digits)}` : digits;
}

export async function listBdMeetings(user: SessionUser): Promise<BdRowDto[]> {
  const seeContacts = can(user, "view_contacts", { type: "bd" });
  const rows = await db.bdMeeting.findMany({
    where: bdScope(user),
    orderBy: [{ meetingDate: "desc" }, { createdAt: "desc" }],
    take: MAX_ROWS,
    include: { primaryBroker: { select: { id: true, name: true } }, secondaryBroker: { select: { id: true, name: true } } },
  });
  return rows.map((m) => {
    const record = { type: "bd" as const, primaryBrokerId: m.primaryBrokerId, secondaryBrokerId: m.secondaryBrokerId, createdById: m.createdById };
    return {
      id: m.id,
      primary: person(m.primaryBroker),
      secondary: m.secondaryBroker ? person(m.secondaryBroker) : null,
      date: dateToIso(m.meetingDate),
      tenantName: m.tenantName,
      contactName: m.contactName,
      designation: m.designation,
      contact: seeContacts ? { phone: displayPhone(decryptOptional(m.clientPhoneEnc)), email: decryptOptional(m.clientEmailEnc) } : null,
      meetingType: m.meetingType,
      temperature: m.temperature,
      mode: m.mode,
      comments: m.comments ?? "",
      canEdit: can(user, "update", record),
      canDelete: can(user, "delete", record),
    };
  });
}
