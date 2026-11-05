import "server-only";
import type { Role } from "@/generated/prisma/enums";
import { PERMISSION_DEFS, type PermissionKey, type PermissionRole } from "@/lib/permissions";
import { db } from "../db";

/**
 * Effective permission set per role = registry defaults overridden by rows in `permissions`.
 * Cached in-process for 30 s and invalidated locally when Settings changes a toggle.
 */
const TTL_MS = 30_000;
const cache = new Map<Role, { at: number; keys: ReadonlySet<PermissionKey> }>();

const ALL_PERMISSIONS: ReadonlySet<PermissionKey> = new Set(PERMISSION_DEFS.map((p) => p.key));

export async function permissionsForRole(role: Role): Promise<ReadonlySet<PermissionKey>> {
  if (role === "OWNER") return ALL_PERMISSIONS;
  const hit = cache.get(role);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.keys;

  const rows = await db.permission.findMany({ where: { role } });
  const overrides = new Map(rows.map((r) => [r.key, r.allowed]));
  const keys = new Set<PermissionKey>();
  for (const def of PERMISSION_DEFS) {
    const allowed = overrides.get(def.key) ?? def.defaults[role as PermissionRole];
    if (allowed) keys.add(def.key);
  }
  cache.set(role, { at: Date.now(), keys });
  return keys;
}

export function invalidatePermissionCache() {
  cache.clear();
}
