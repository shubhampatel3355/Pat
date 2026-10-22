import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamScreen } from "@/components/team/team-screen";
import { requireUser } from "@/server/auth/session";
import { can, has, isOwner } from "@/server/policy";
import { teamSummary } from "@/server/services/team";
import { listPartners } from "@/server/view";

export const metadata: Metadata = { title: "Teams" };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function TeamsPage() {
  const user = await requireUser();
  if (!can(user, "view", { type: "team" })) notFound();
  const [summary, partners] = await Promise.all([teamSummary(user), listPartners()]);
  const { employees, admins, partners: partnerCount } = summary.counts;
  return (
    <TeamScreen
      members={summary.members}
      partners={partners.map((p) => ({ id: p.id, name: p.name }))}
      meta={`${plural(employees, "employee")} · ${plural(admins, "admin")} · ${plural(partnerCount, "partner")}`}
      quarterShort={summary.quarterShort}
      canManage={has(user, "teams.manage")}
      canSeeCtc={has(user, "payroll.view_all")}
      canMakeOwner={isOwner(user)}
      canUploadDocs={has(user, "vault.employee_all")}
    />
  );
}
