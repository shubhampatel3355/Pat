import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "../db";
import type { SessionUser } from "../policy";
import { permissionsForRole } from "../policy/permissions";
import { auth } from "./config";

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

/**
 * The signed-in user, re-validated against the database on every request:
 * deactivated users and sessions issued before a password change are rejected immediately.
 * Memoised per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return null;
  const user = await db.user.findFirst({ where: { id: uid, deletedAt: null } });
  if (!user || !user.active) return null;
  if ((session.sv ?? 0) !== user.sessionVersion) return null;
  const perms = await permissionsForRole(user.role);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: user.name.split(/\s+/)[0] ?? user.name,
    initials: initialsOf(user.name),
    role: user.role,
    title: user.title,
    partnerId: user.partnerId,
    mustChangePassword: user.mustChangePassword,
    perms,
  };
});

/** For pages and layouts: redirect to /login (or to the forced password change) when needed. */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/change-password");
  return user;
}
