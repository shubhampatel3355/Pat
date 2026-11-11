import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { isAdminOrOwner, type SessionUser } from "./policy";

export const VIEW_COOKIE = "pm_view";

export interface PartnerOption {
  id: string;
  name: string;
  initials: string;
}

export interface ViewState {
  /** "company" or a partner (owner) user id. */
  value: string;
  partner: PartnerOption | null;
  partners: PartnerOption[];
  canSwitch: boolean;
}

export async function listPartners(): Promise<PartnerOption[]> {
  const owners = await db.user.findMany({
    where: { role: "OWNER", active: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  return owners.map((o) => ({ id: o.id, name: o.name, initials: o.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() }));
}

/** Company / Partner view chosen in the top bar (owners and admins only). */
export async function currentView(user: SessionUser): Promise<ViewState> {
  return viewFor(user, (await cookies()).get(VIEW_COOKIE)?.value ?? "company");
}

/** The view for a requested value: "company" or a partner id (the cookie on the web, a parameter in the mobile app). */
export async function viewFor(user: SessionUser, requested: string): Promise<ViewState> {
  const partners = await listPartners();
  const canSwitch = isAdminOrOwner(user);
  const partner = canSwitch ? (partners.find((p) => p.id === requested) ?? null) : null;
  return { value: partner ? partner.id : "company", partner, partners, canSwitch };
}

/** User ids in a partner's team (the partner plus everyone reporting to them). */
export async function partnerTeamIds(partnerId: string): Promise<string[]> {
  const team = await db.user.findMany({ where: { partnerId, deletedAt: null }, select: { id: true } });
  return [partnerId, ...team.map((t) => t.id)];
}
