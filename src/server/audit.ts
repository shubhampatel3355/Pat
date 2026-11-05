import "server-only";
import type { AuditVisibility } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "./db";
import type { SessionUser } from "./policy";
import type { RequestMeta } from "./request";

type AuditModule =
  | "Auth"
  | "Dashboard"
  | "WIP"
  | "Tasks"
  | "Business Development"
  | "Vehicles"
  | "Finance"
  | "Invoices"
  | "Payroll"
  | "Teams"
  | "Vault"
  | "Settings";

type AuditAction = "create" | "update" | "delete" | "export" | "login" | "login_failed" | "logout" | "approve" | "download" | "email";

interface AuditInput {
  actor: Pick<SessionUser, "id" | "name"> | null;
  module: AuditModule;
  action: AuditAction;
  text: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  meta?: RequestMeta;
  /** PUBLIC: everyone; RESTRICTED: owners/admins + subjectUserIds; PRIVATE: owners/admins. */
  visibility?: AuditVisibility;
  subjectUserIds?: string[];
  /** Show in the Dashboard "Team activity" ticker. */
  feed?: boolean;
}

const SECRET_KEY = /password|hash|token|secret|Enc$/i;

/** JSON-safe, secret-free snapshot (bigint → number/string, dates → ISO, ciphertext dropped). */
function snapshot(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  const json = JSON.stringify(value, (key, v) => {
    if (key && SECRET_KEY.test(key)) return undefined;
    if (typeof v === "bigint") return Number.isSafeInteger(Number(v)) ? Number(v) : v.toString();
    return v;
  });
  return json === undefined ? undefined : (JSON.parse(json) as Prisma.InputJsonValue);
}

export async function writeAudit(client: Tx | typeof db, input: AuditInput): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: input.actor?.id ?? null,
      actorName: input.actor?.name ?? "System",
      module: input.module,
      action: input.action,
      text: input.text.slice(0, 500),
      entityType: input.entityType,
      entityId: input.entityId,
      before: snapshot(input.before),
      after: snapshot(input.after),
      ip: input.meta?.ip ?? null,
      userAgent: input.meta?.userAgent ?? null,
      visibility: input.visibility ?? "PRIVATE",
      subjectUserIds: input.subjectUserIds ?? [],
      feed: input.feed ?? false,
    },
  });
}
