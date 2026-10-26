import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { financialYear, fyOfIso, isoDateIST, quarterBounds, type FinancialYear } from "@/lib/dates";
import { toPaise } from "@/lib/money";
import { PERMISSION_DEFS, type PermissionDef } from "@/lib/permissions";
import { initialsOf } from "../auth/session";
import { companyProfile } from "../company";
import { db } from "../db";
import { env } from "../env";
import { permissionsForRole } from "../policy/permissions";

// ── General ───────────────────────────────────────────────────────────────────

export interface InfoRow {
  k: string;
  v: string;
}

/** Company identity comes from the server configuration (COMPANY_*); shown read-only. */
export async function companyRows(): Promise<InfoRow[]> {
  const c = companyProfile();
  const owners = await db.user.findMany({ where: { role: "OWNER", deletedAt: null }, orderBy: { createdAt: "asc" }, select: { name: true } });
  return [
    { k: "Legal name", v: c.legalName },
    { k: "GSTIN", v: c.gstin },
    { k: "RERA agent no.", v: c.rera },
    { k: "Registered office", v: c.address },
    { k: "Partners", v: owners.map((o) => o.name).join(" · ") || "—" },
    { k: "Bank account", v: c.bank ? `${c.bank.name} · A/c ••••${c.bank.accountNumber.slice(-4)} · ${c.bank.ifsc}` : "Not configured" },
    { k: "Authorised signatory", v: `${c.signatory.name}, ${c.signatory.title}` },
  ];
}

export function preferenceRows(): InfoRow[] {
  const fy = fyOfIso(isoDateIST());
  return [
    { k: "Financial year", v: "April – March" },
    { k: "Currency", v: "INR · Indian digit grouping" },
    { k: "Time zone", v: "Asia/Kolkata (IST)" },
    { k: "Document numbers", v: `PM/${fy.short}/0001 · PF · CN, per financial year` },
    { k: "GST", v: "18% · CGST + SGST in Karnataka, IGST elsewhere" },
    { k: "Payroll", v: "Basic 50% · PF 12% of basic · Karnataka PT" },
  ];
}

export interface TargetsView {
  fy: FinancialYear;
  quarter: 1 | 2 | 3 | 4;
  quarterLabel: string;
  fyOptions: { value: number; label: string }[];
  company: { revenue: number | null; wipFees: number | null };
  partners: { id: string; name: string; revenue: number | null }[];
  members: { id: string; name: string; initials: string; title: string; revenue: number | null; wipFees: number | null }[];
}

export async function targetsView(fyStart: number, quarter: 1 | 2 | 3 | 4): Promise<TargetsView> {
  const fy = financialYear(fyStart);
  const qKey = `${fy.key}-Q${quarter}`;
  const [rows, people] = await Promise.all([
    db.target.findMany({ where: { period: { in: [fy.key, qKey] } } }),
    db.user.findMany({ where: { active: true, deletedAt: null }, orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true, title: true, role: true } }),
  ]);
  const get = (scope: string, scopeKey: string, metric: string, period: string) => {
    const r = rows.find((t) => t.scope === scope && t.scopeKey === scopeKey && t.metric === metric && t.period === period);
    return r ? toPaise(r.amountPaise) : null;
  };
  const current = fyOfIso(isoDateIST()).startYear;
  return {
    fy,
    quarter,
    quarterLabel: `${quarterBounds(fy, quarter).label} · ${quarterBounds(fy, quarter).months}`,
    fyOptions: [current - 1, current, current + 1].map((y) => ({ value: y, label: financialYear(y).label })),
    company: { revenue: get("COMPANY", "company", "REVENUE", fy.key), wipFees: get("COMPANY", "company", "WIP_FEES", qKey) },
    partners: people.filter((p) => p.role === "OWNER").map((p) => ({ id: p.id, name: p.name, revenue: get("PARTNER", p.id, "REVENUE", fy.key) })),
    members: people
      .filter((p) => p.role !== "OWNER")
      .map((p) => ({ id: p.id, name: p.name, initials: initialsOf(p.name), title: p.title ?? "Team member", revenue: get("USER", p.id, "REVENUE", qKey), wipFees: get("USER", p.id, "WIP_FEES", qKey) })),
  };
}

// ── Roles & permissions ───────────────────────────────────────────────────────

export interface RolesMatrix {
  roles: { role: Role; label: string; users: number }[];
  groups: { group: PermissionDef["group"]; rows: { key: string; label: string; description: string; admin: boolean; employee: boolean }[] }[];
}

export async function rolesMatrix(): Promise<RolesMatrix> {
  const [counts, admin, employee] = await Promise.all([
    db.user.groupBy({ by: ["role"], where: { active: true, deletedAt: null }, _count: { _all: true } }),
    permissionsForRole("ADMIN"),
    permissionsForRole("EMPLOYEE"),
  ]);
  const count = (role: Role) => counts.find((c) => c.role === role)?._count._all ?? 0;
  const groups: RolesMatrix["groups"] = [];
  for (const def of PERMISSION_DEFS) {
    let g = groups.find((x) => x.group === def.group);
    if (!g) groups.push((g = { group: def.group, rows: [] }));
    g.rows.push({ key: def.key, label: def.label, description: def.description, admin: admin.has(def.key), employee: employee.has(def.key) });
  }
  return {
    roles: [
      { role: "OWNER", label: "Owner", users: count("OWNER") },
      { role: "ADMIN", label: "Admin", users: count("ADMIN") },
      { role: "EMPLOYEE", label: "Employee", users: count("EMPLOYEE") },
    ],
    groups,
  };
}

// ── Integrations ──────────────────────────────────────────────────────────────

export interface IntegrationCard {
  mono: string;
  name: string;
  kind: string;
  description: string;
  status: "Connected" | "Development" | "Off" | "Not configured" | "Coming soon";
  detail: string;
}

/** What is wired up, read from the server configuration (changed by redeploying with new variables). */
export function integrationCards(): IntegrationCard[] {
  const e = env();
  const cards: IntegrationCard[] = [
    {
      mono: "SM",
      name: "Email delivery",
      kind: "SMTP",
      description: "Invoices, payslips, invites, password resets and reminders.",
      status: e.MAIL_DRIVER === "smtp" ? "Connected" : "Development",
      detail: e.MAIL_DRIVER === "smtp" ? `${e.SMTP_HOST}:${e.SMTP_PORT} · from ${e.MAIL_FROM}` : "Writing emails to .local/mail",
    },
    {
      mono: "S3",
      name: "Document storage",
      kind: "S3 / MinIO",
      description: "Uploads, invoice and payslip PDFs. Downloads use signed links that expire in a minute.",
      status: e.STORAGE_DRIVER === "s3" ? "Connected" : "Development",
      detail: e.STORAGE_DRIVER === "s3" ? `Bucket ${e.S3_BUCKET}${e.S3_SSE ? " · encrypted at rest" : " · not encrypted at rest"}` : "Local folder .local/storage",
    },
    { mono: "AV", name: "Virus scanning", kind: "ClamAV", description: "Every upload is scanned before it is stored.", status: e.CLAMAV_HOST ? "Connected" : "Off", detail: e.CLAMAV_HOST ? `${e.CLAMAV_HOST}:${e.CLAMAV_PORT}` : "Set CLAMAV_HOST to scan uploads" },
    { mono: "G", name: "Google sign-in", kind: "Single sign-on", description: "People sign in with their Google Workspace account.", status: e.AUTH_GOOGLE_ID ? "Connected" : "Not configured", detail: e.AUTH_GOOGLE_ID ? "Enabled on the sign-in page" : "Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET" },
    { mono: "SE", name: "Error tracking", kind: "Sentry", description: "Server errors are reported with the request that caused them.", status: e.SENTRY_DSN ? "Connected" : "Off", detail: e.SENTRY_DSN ? "Reporting server errors" : "Set SENTRY_DSN to report errors" },
  ];
  if (e.FEATURES.has("integrations-preview")) {
    cards.push(
      { mono: "WA", name: "WhatsApp Business API", kind: "Messaging", description: "Follow-up messages and task reminders on WhatsApp.", status: "Coming soon", detail: "Planned" },
      { mono: "GC", name: "Google Calendar", kind: "Calendar", description: "Follow-ups and BD meetings on each person's calendar.", status: "Coming soon", detail: "Planned" },
      { mono: "TA", name: "Tally Prime", kind: "Accounting", description: "Nightly ledger sync with GST categories.", status: "Coming soon", detail: "Planned" },
      { mono: "RZ", name: "Razorpay", kind: "Payments", description: "Payment links on invoices, reconciled automatically.", status: "Coming soon", detail: "Planned" },
    );
  }
  return cards;
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export const AUDIT_MODULES = ["Auth", "Dashboard", "WIP", "Tasks", "Business Development", "Vehicles", "Finance", "Invoices", "Payroll", "Teams", "Vault", "Settings"] as const;

export interface AuditRowDto {
  id: string;
  initials: string;
  actor: string;
  text: string;
  module: string;
  action: string;
  ip: string | null;
  at: string;
  before: string | null;
  after: string | null;
}

const PAGE = 50;

/** Newest first, optionally one module, paged by (created_at, id). */
export async function auditPage(module: string | null, before: string | null): Promise<{ rows: AuditRowDto[]; next: string | null }> {
  const where: Prisma.AuditLogWhereInput = {};
  if (module && (AUDIT_MODULES as readonly string[]).includes(module)) where.module = module;
  const cursor = before?.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\|([0-9a-f-]{36})$/i);
  if (cursor) where.OR = [{ createdAt: { lt: new Date(cursor[1]!) } }, { createdAt: new Date(cursor[1]!), id: { lt: cursor[2]! } }];
  const rows = await db.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE + 1 });
  const page = rows.slice(0, PAGE);
  const last = page[page.length - 1];
  const json = (v: Prisma.JsonValue | null) => (v === null || v === undefined ? null : JSON.stringify(v, null, 2));
  return {
    rows: page.map((r) => ({
      id: r.id,
      initials: r.actorName === "System" ? "OS" : initialsOf(r.actorName),
      actor: r.actorName,
      text: r.text,
      module: r.module,
      action: r.action,
      ip: r.ip,
      at: r.createdAt.toISOString(),
      before: json(r.before),
      after: json(r.after),
    })),
    next: rows.length > PAGE && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
  };
}
