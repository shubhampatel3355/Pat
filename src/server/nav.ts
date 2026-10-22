import "server-only";
import type { IconName } from "@/lib/icons";
import { can, type SessionUser } from "./policy";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Sidebar structure from the prototype, filtered by what the user may open. */
export function navFor(user: SessionUser): NavGroup[] {
  const groups: { label: string; items: (NavItem & { allowed: boolean })[] }[] = [
    {
      label: "Sell",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard", allowed: true },
        { href: "/wip", label: "WIP", icon: "leads", allowed: can(user, "view", { type: "wip" }) },
        { href: "/follow-ups", label: "Follow-ups & Tasks", icon: "followups", allowed: can(user, "view", { type: "task" }) },
        { href: "/business-development", label: "Business Development", icon: "bizdev", allowed: can(user, "view", { type: "bd" }) },
      ],
    },
    { label: "Operate", items: [{ href: "/vehicles", label: "Vehicle Management", icon: "car", allowed: can(user, "view", { type: "cab" }) }] },
    {
      label: "Money",
      items: [
        { href: "/finance", label: "Finance", icon: "finance", allowed: can(user, "view", { type: "finance" }) },
        { href: "/invoices", label: "Invoice", icon: "invoice", allowed: can(user, "view", { type: "invoice" }) },
        { href: "/payroll", label: "Payroll", icon: "payroll", allowed: can(user, "view", { type: "payroll" }) },
      ],
    },
    { label: "People", items: [{ href: "/teams", label: "Teams", icon: "teams", allowed: can(user, "view", { type: "team" }) }] },
    {
      label: "Admin",
      items: [
        { href: "/vault", label: "Contracts & Vault", icon: "vault", allowed: true },
        { href: "/settings", label: "Settings", icon: "settings", allowed: can(user, "view", { type: "settings" }) },
      ],
    },
  ];
  return groups
    .map((g) => ({ label: g.label, items: g.items.filter((i) => i.allowed).map(({ allowed: _a, ...i }) => i) }))
    .filter((g) => g.items.length > 0);
}

export interface QuickCreateItem {
  label: string;
  icon: IconName;
  href: string;
}

export function quickCreateFor(user: SessionUser): QuickCreateItem[] {
  const items: (QuickCreateItem & { allowed: boolean })[] = [
    { label: "New lead", icon: "leads", href: "/wip?new=1", allowed: can(user, "create", { type: "wip" }) },
    { label: "Task", icon: "followups", href: "/follow-ups?new=task", allowed: can(user, "create", { type: "task" }) },
    { label: "Follow-up", icon: "phone", href: "/follow-ups?new=followup", allowed: can(user, "create", { type: "followup" }) },
    { label: "Meeting", icon: "bizdev", href: "/business-development?new=1", allowed: can(user, "create", { type: "bd" }) },
    { label: "Book cab", icon: "car", href: "/vehicles", allowed: can(user, "create", { type: "cab" }) },
    { label: "Expense", icon: "finance", href: "/finance?expense=1", allowed: can(user, "record", { type: "finance" }) },
  ];
  return items.filter((i) => i.allowed).map(({ allowed: _a, ...i }) => i);
}
