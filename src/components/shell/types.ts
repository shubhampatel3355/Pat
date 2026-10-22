import type { IconName } from "@/lib/icons";

export interface ShellNavGroup {
  label: string;
  items: { href: string; label: string; icon: IconName }[];
}

export interface ShellUser {
  name: string;
  email: string;
  initials: string;
  role: "OWNER" | "ADMIN" | "EMPLOYEE";
}

export interface ShellView {
  value: string;
  canSwitch: boolean;
  partners: { id: string; name: string; initials: string }[];
}

export interface ShellQuickItem {
  label: string;
  icon: IconName;
  href: string;
}
