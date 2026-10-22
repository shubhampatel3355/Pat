import "server-only";
import type { FolderKey, Role } from "@/generated/prisma/enums";
import type { PermissionKey } from "@/lib/permissions";

/** The signed-in user as seen by every server-side check. */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  firstName: string;
  initials: string;
  role: Role;
  title: string | null;
  partnerId: string | null;
  mustChangePassword: boolean;
  perms: ReadonlySet<PermissionKey>;
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have access to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export const isOwner = (u: SessionUser) => u.role === "OWNER";
export const isAdminOrOwner = (u: SessionUser) => u.role === "OWNER" || u.role === "ADMIN";
export const has = (u: SessionUser, key: PermissionKey) => u.role === "OWNER" || u.perms.has(key);

export type Action =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "export"
  | "manage"
  | "approve"
  | "record"
  | "view_contacts"
  | "credit_note";

/** Everything `can()` knows how to reason about. Record fields are optional for type-level checks. */
export type Resource =
  | { type: "dashboard" }
  | { type: "wip"; brokerUserIds?: string[] }
  | { type: "task"; assigneeId?: string; createdById?: string }
  | { type: "followup"; ownerId?: string; createdById?: string }
  | { type: "todo"; userId?: string }
  | { type: "bd"; primaryBrokerId?: string; secondaryBrokerId?: string | null; createdById?: string }
  | { type: "cab"; bookedForId?: string; createdById?: string }
  | { type: "finance" }
  | { type: "invoice" }
  | { type: "payroll"; userId?: string }
  | { type: "team"; targetRole?: Role; targetId?: string }
  | { type: "targets" }
  | { type: "vault"; folder: FolderKey; ownerUserId?: string | null; uploadedById?: string }
  | { type: "settings" }
  | { type: "roles" }
  | { type: "audit" };

const involved = (u: SessionUser, ...ids: (string | null | undefined)[]) => ids.some((id) => id && id === u.id);

/**
 * The single authorisation entry point. Route handlers, server actions and services call this
 * (or `assertCan`) before reading or changing anything. Lists use the matching `scope*` helpers
 * in ./scopes.ts so list results and single-record checks always agree.
 */
export function can(u: SessionUser, action: Action, r: Resource): boolean {
  if (u.role === "OWNER") return true;

  switch (r.type) {
    case "dashboard":
      return action === "view";

    case "wip": {
      const mine = r.brokerUserIds ? r.brokerUserIds.includes(u.id) : false;
      if (action === "view") return has(u, "wip.view_all") || mine || r.brokerUserIds === undefined;
      if (action === "create") return true; // anyone can add a mandate; they must be a broker on it unless they can edit all
      if (action === "update") return has(u, "wip.edit_all") || mine;
      if (action === "delete") return has(u, "wip.delete");
      if (action === "export") return has(u, "wip.view_all");
      return false;
    }

    case "task": {
      const mine = involved(u, r.assigneeId, r.createdById);
      if (action === "create") return true;
      if (action === "view" || action === "update") return has(u, "tasks.view_all") || mine || (r.assigneeId === undefined && r.createdById === undefined);
      if (action === "delete") return has(u, "tasks.view_all") || involved(u, r.createdById);
      return false;
    }

    case "followup": {
      const mine = involved(u, r.ownerId, r.createdById);
      if (action === "create") return true;
      if (action === "view" || action === "update" || action === "delete") return has(u, "tasks.view_all") || mine || (r.ownerId === undefined && r.createdById === undefined);
      return false;
    }

    case "todo":
      return r.userId === undefined || r.userId === u.id;

    case "bd": {
      const mine = involved(u, r.primaryBrokerId, r.secondaryBrokerId, r.createdById);
      if (action === "create") return true;
      if (action === "view") return has(u, "bd.view_all") || mine || r.primaryBrokerId === undefined;
      if (action === "update") return has(u, "bd.view_all") || mine;
      if (action === "delete") return has(u, "bd.view_all");
      if (action === "view_contacts") return has(u, "bd.view_contacts");
      return false;
    }

    case "cab": {
      if (action === "view" || action === "create") return true; // Vehicle Management is open to everyone
      if (action === "update") return has(u, "vehicles.manage"); // confirm / complete
      if (action === "delete") return has(u, "vehicles.manage") || involved(u, r.bookedForId, r.createdById); // cancel
      return false;
    }

    case "finance":
      if (action === "view") return has(u, "finance.view");
      if (action === "export") return has(u, "finance.export");
      if (action === "record") return has(u, "finance.record");
      return false;

    case "invoice":
      if (action === "view") return has(u, "invoices.view");
      if (action === "create") return has(u, "invoices.create");
      if (action === "credit_note") return has(u, "invoices.credit_note");
      if (action === "record") return has(u, "finance.record");
      return false;

    case "payroll":
      if (action === "view") return has(u, "payroll.view_all") || r.userId === u.id || r.userId === undefined;
      if (action === "manage" || action === "approve") return has(u, "payroll.run");
      return false;

    case "team":
      if (action === "view") return has(u, "teams.view") || r.targetId === u.id;
      if (action === "create" || action === "update" || action === "delete") {
        if (!has(u, "teams.manage")) return false;
        // Only owners create, change or remove owners.
        return r.targetRole !== "OWNER";
      }
      return false;

    case "targets":
      if (action === "view") return true;
      return has(u, "targets.manage");

    case "vault": {
      const folderKey = r.folder === "PM_DOCUMENTS" ? "vault.pm" : r.folder === "CLIENT_DOCUMENTS" ? "vault.client" : null;
      if (folderKey) return has(u, folderKey); // full access to the folder, or none
      // Employee Documents: everyone may open the folder; files are limited to their own unless vault.employee_all.
      if (has(u, "vault.employee_all")) return true;
      if (action === "view" && r.ownerUserId === undefined) return true; // folder listing (scoped)
      if (action === "create") return true; // uploads are stamped with the uploader as owner
      if (action === "delete") return involved(u, r.uploadedById) && r.ownerUserId === u.id;
      return r.ownerUserId === u.id;
    }

    case "settings":
      if (action === "view") return has(u, "settings.manage") || has(u, "audit.view");
      return has(u, "settings.manage");

    case "roles":
      return action === "view" ? isAdminOrOwner(u) : false; // owners only (handled above)

    case "audit":
      return has(u, "audit.view");
  }
}

export function assertCan(u: SessionUser, action: Action, r: Resource, message?: string): void {
  if (!can(u, action, r)) throw new ForbiddenError(message);
}
