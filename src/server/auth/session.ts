import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "../db";
import type { SessionUser } from "../policy";
import { permissionsForRole } from "../policy/permissions";
import { bearerToken } from "../request";
import { auth } from "./config";
import { verifyMobileToken } from "./mobile-token";

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

/** Who is calling: the mobile app's bearer token, or else the browser's Auth.js session. */
async function caller(): Promise<{ uid: string; sv: number } | null> {
  const token = bearerToken(await headers());
  // A request with a bearer token is authenticated by that token alone, never by cookies.
  if (token !== null) return verifyMobileToken(token);
  const session = await auth();
  const uid = session?.user?.id;
  return uid ? { uid, sv: session.sv ?? 0 } : null;
}

/**
 * The signed-in user, re-validated against the database on every request:
 * deactivated users and sessions issued before a password change are rejected immediately.
 * Memoised per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const who = await caller();
  if (!who) return null;
  const user = await db.user.findFirst({
    where: { id: who.uid, deletedAt: null },
    select: { id: true, email: true, name: true, role: true, title: true, partnerId: true, active: true, sessionVersion: true, mustChangePassword: true },
  });
  if (!user || !user.active) return null;
  if (who.sv !== user.sessionVersion) return null;
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

/** For route handlers and print pages: null when signed out or still on a first-login password. */
export async function getApiUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  return user && !user.mustChangePassword ? user : null;
}

/** For pages and layouts: redirect to /login (or to the forced password change) when needed. */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/change-password");
  return user;
}
