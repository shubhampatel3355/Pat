/**
 * Permission registry. Rows in the `permissions` table override the defaults below per role.
 * OWNER always has every permission (not stored, not toggleable). Owner-only capabilities
 * (changing owners, editing role definitions) are hard-coded in the policy and are not listed here.
 */
export type PermissionRole = "ADMIN" | "EMPLOYEE";

export interface PermissionDef {
  key: string;
  label: string;
  description: string;
  group: "Sell" | "Operate" | "Money" | "People" | "Admin";
  defaults: Record<PermissionRole, boolean>;
}

const admin = { ADMIN: true, EMPLOYEE: false };

export const PERMISSION_DEFS = [
  { key: "wip.view_all", label: "View all WIP", description: "Not just rows where they are a broker", group: "Sell", defaults: admin },
  { key: "wip.edit_all", label: "Edit any WIP row", description: "Details and remarks on every row", group: "Sell", defaults: admin },
  { key: "wip.delete", label: "Delete WIP rows", description: "Remove a tenant / lead", group: "Sell", defaults: admin },
  { key: "tasks.view_all", label: "View everyone's tasks", description: "Tasks and follow-ups of the whole team", group: "Sell", defaults: admin },
  { key: "bd.view_all", label: "View all BD meetings", description: "Not just their own meetings", group: "Sell", defaults: admin },
  { key: "bd.view_contacts", label: "See client contact info", description: "Phone and email on BD meetings", group: "Sell", defaults: admin },
  { key: "vehicles.manage", label: "Manage cab bookings", description: "Confirm, complete or cancel any booking", group: "Operate", defaults: admin },
  { key: "finance.view", label: "View finance", description: "Revenue, receivables and expenses", group: "Money", defaults: admin },
  { key: "finance.record", label: "Record payments & expenses", description: "Post receipts and expenses to the ledger", group: "Money", defaults: admin },
  { key: "finance.export", label: "Export finance reports", description: "XLSX and PDF", group: "Money", defaults: admin },
  { key: "invoices.view", label: "View invoices", description: "Invoices and proformas", group: "Money", defaults: admin },
  { key: "invoices.create", label: "Raise invoices", description: "Invoices, proformas and conversions", group: "Money", defaults: admin },
  { key: "invoices.credit_note", label: "Issue credit notes", description: "Reverse an issued invoice", group: "Money", defaults: admin },
  { key: "payroll.view_all", label: "View all payroll", description: "CTC and payslips of every employee", group: "Money", defaults: admin },
  { key: "payroll.run", label: "Run payroll", description: "Review, approve and disburse", group: "Money", defaults: admin },
  { key: "teams.view", label: "View team", description: "Member cards and targets", group: "People", defaults: admin },
  { key: "teams.manage", label: "Manage team members", description: "Invite, edit and deactivate", group: "People", defaults: admin },
  { key: "targets.manage", label: "Set targets", description: "Company, partner and member targets", group: "People", defaults: admin },
  { key: "vault.pm", label: "Pat Michaels Documents", description: "Company documents folder", group: "Admin", defaults: admin },
  { key: "vault.client", label: "Client Documents", description: "Fee letters, LOIs and KYC", group: "Admin", defaults: admin },
  { key: "vault.employee_all", label: "All employee documents", description: "Otherwise only their own files", group: "Admin", defaults: admin },
  { key: "settings.manage", label: "Manage settings", description: "General settings and integrations", group: "Admin", defaults: admin },
  { key: "audit.view", label: "View audit log", description: "Every change, export and sign-in", group: "Admin", defaults: admin },
] as const satisfies readonly PermissionDef[];

export type PermissionKey = (typeof PERMISSION_DEFS)[number]["key"];

export const PERMISSION_KEYS = PERMISSION_DEFS.map((p) => p.key) as PermissionKey[];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as string[]).includes(value);
}

export const ROLE_LABELS = { OWNER: "Owner", ADMIN: "Admin", EMPLOYEE: "Employee" } as const;
