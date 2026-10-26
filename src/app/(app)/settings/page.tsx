import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuditTab, GeneralTab, IntegrationsTab, RolesTab, SettingsScreen, type SettingsTab } from "@/components/settings/settings-screen";
import { fyOfIso, fyQuarterOfIso, isoDateIST } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import { can, has, isAdminOrOwner, isOwner } from "@/server/policy";
import { AUDIT_MODULES, auditPage, companyRows, integrationCards, preferenceRows, rolesMatrix, targetsView } from "@/server/services/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "view", { type: "settings" })) notFound();
  const sp = await searchParams;
  const param = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);

  const tabs: SettingsTab[] = [
    ...(has(user, "settings.manage") ? (["general"] as const) : []),
    ...(isAdminOrOwner(user) ? (["roles"] as const) : []),
    ...(has(user, "settings.manage") ? (["integrations"] as const) : []),
    ...(has(user, "audit.view") ? (["audit"] as const) : []),
  ];
  const tab = (tabs as string[]).includes(param("tab") ?? "") ? (param("tab") as SettingsTab) : tabs[0];
  if (!tab) notFound();

  let body: React.ReactNode;
  if (tab === "general") {
    const today = isoDateIST();
    const current = fyOfIso(today).startYear;
    const fy = Number(param("fy")) || current;
    const q = Number(param("q"));
    const quarter = ([1, 2, 3, 4].includes(q) ? q : fy === current ? fyQuarterOfIso(today).q : 1) as 1 | 2 | 3 | 4;
    const [company, targets] = await Promise.all([companyRows(), Math.abs(fy - current) <= 1 ? targetsView(fy, quarter) : Promise.resolve(null)]);
    body = <GeneralTab company={company} preferences={preferenceRows()} targets={targets} canEditTargets={can(user, "update", { type: "targets" })} />;
  } else if (tab === "roles") {
    body = <RolesTab matrix={await rolesMatrix()} canEdit={isOwner(user)} />;
  } else if (tab === "integrations") {
    body = <IntegrationsTab cards={integrationCards()} />;
  } else {
    const moduleParam = param("module");
    const auditModule = moduleParam && (AUDIT_MODULES as readonly string[]).includes(moduleParam) ? moduleParam : null;
    const page = await auditPage(auditModule, param("before"));
    body = <AuditTab modules={AUDIT_MODULES} module={auditModule} rows={page.rows} next={page.next} />;
  }
  return (
    <SettingsScreen tab={tab} tabs={tabs}>
      {body}
    </SettingsScreen>
  );
}
