import "server-only";
import { addDaysIso, defaultPickupSlot, fyOfIso, fyQuarterOfIso, formatLongDate, hourIST, isoDateIST } from "@/lib/dates";
import { shortMonthLabel } from "@/lib/payroll";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { companyProfile } from "../company";
import { env } from "../env";
import { navFor, quickCreateFor } from "../nav";
import { can, has, isAdminOrOwner, isOwner, type SessionUser } from "../policy";
import { listBdMeetings } from "../services/bd";
import { dashboardData } from "../services/dashboard";
import { financeOverview, financeYears, ledgerEntries } from "../services/finance";
import { incentiveFor } from "../services/incentive";
import { invoicePrefill, listDocuments, peekNumber } from "../services/invoices";
import { latestRun, nextRunPeriod, payrollEmployees } from "../services/payroll";
import { AUDIT_MODULES, auditPage, companyRows, integrationCards, preferenceRows, rolesMatrix, targetsView } from "../services/settings";
import { linkableLeads, listFollowUps, listTasks } from "../services/tasks";
import { teamSummary } from "../services/team";
import { FOLDER_BY_SLUG, vaultFiles, vaultFolders } from "../services/vault";
import { bookingPeople, cabStats, listCabBookings, pickupSuggestions } from "../services/vehicles";
import { activeUserOptions, listWip, wipCards, wipTarget } from "../services/wip";
import { storageEncrypted } from "../storage";
import { listPartners, viewFor } from "../view";
import { NotFoundError } from "./http";

/**
 * What each mobile screen loads. Every function mirrors the matching web page in src/app/(app): the same
 * services, the same permission checks, the same defaults — only the response is JSON instead of HTML.
 */

function lastDayOfMonth(iso: string, monthsAhead = 0): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1 + monthsAhead + 1, 0)).toISOString().slice(0, 10);
}

const greeting = (hour: number) => (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");

/** Signed-in user, what they may open (same filter as the web sidebar) and server facts the app needs. */
export async function meView(user: SessionUser) {
  const view = await viewFor(user, "company");
  const company = companyProfile();
  return {
    user: { id: user.id, name: user.name, firstName: user.firstName, initials: user.initials, email: user.email, role: user.role, title: user.title, mustChangePassword: user.mustChangePassword },
    perms: user.role === "OWNER" ? PERMISSION_KEYS : PERMISSION_KEYS.filter((k) => user.perms.has(k)),
    nav: navFor(user),
    quickCreate: quickCreateFor(user),
    partners: view.canSwitch ? view.partners : [],
    company: { shortName: company.shortName, legalName: company.legalName },
    appUrl: env().APP_URL.replace(/\/$/, ""),
    today: isoDateIST(),
    now: new Date().toISOString(),
  };
}

export async function dashboardView(user: SessionUser, requestedView: string) {
  const view = await viewFor(user, requestedView);
  const data = await dashboardData(user, view);
  return {
    data,
    greeting: `${greeting(hourIST())}, ${user.firstName}`,
    dateLabel: formatLongDate(isoDateIST()),
    view: { value: view.value, canSwitch: view.canSwitch, partners: view.partners },
  };
}

export async function wipView(user: SessionUser) {
  if (!can(user, "view", { type: "wip" })) throw new NotFoundError();
  const today = isoDateIST();
  const [rows, target, users] = await Promise.all([listWip(user), wipTarget(user, today), activeUserOptions()]);
  return {
    rows,
    cards: { ...wipCards(rows, today), targetPaise: target },
    users,
    me: user.id,
    today,
    monthEnd: lastDayOfMonth(today),
    defaultClosure: lastDayOfMonth(addDaysIso(today, 1), 1),
    canCreate: can(user, "create", { type: "wip" }),
    canInvoice: has(user, "invoices.create"),
  };
}

export async function followUpsView(user: SessionUser) {
  if (!can(user, "view", { type: "task" })) throw new NotFoundError();
  const now = new Date();
  const [followUps, tasks, users, leads] = await Promise.all([listFollowUps(user), listTasks(user), activeUserOptions(), linkableLeads(user)]);
  return { followUps, tasks, users, leads, me: user.id, today: isoDateIST(now), now: now.toISOString() };
}

export async function bdView(user: SessionUser) {
  if (!can(user, "view", { type: "bd" })) throw new NotFoundError();
  const [rows, users] = await Promise.all([listBdMeetings(user), activeUserOptions()]);
  return { rows, users, me: user.id, today: isoDateIST(), canSeeContacts: can(user, "view_contacts", { type: "bd" }) };
}

export async function vehiclesView(user: SessionUser) {
  if (!can(user, "view", { type: "cab" })) throw new NotFoundError();
  const today = isoDateIST();
  const [rows, stats, people, places] = await Promise.all([listCabBookings(user, today), cabStats(today), bookingPeople(), pickupSuggestions()]);
  return { rows, stats, people, places, me: user.id, today, defaultPickup: defaultPickupSlot() };
}

const RECENT_ENTRIES = 30;

export async function financeView(user: SessionUser, requestedFy: number) {
  if (!can(user, "view", { type: "finance" })) throw new NotFoundError();
  const today = isoDateIST();
  const years = await financeYears(today);
  const fy = years.find((y) => y.startYear === requestedFy) ?? years[0]!;
  const overview = await financeOverview(fy, today);
  const entries = await ledgerEntries(overview.period.from, overview.period.to, RECENT_ENTRIES);
  return {
    fy: fy.startYear,
    years: years.map((y) => ({ value: y.startYear, label: y.label })),
    periodLabel: overview.period.toDate ? `${fy.label} · ${overview.period.label} · year to date` : `${fy.label} · ${overview.period.label}`,
    overview,
    entries,
    today,
    can: { record: can(user, "record", { type: "finance" }), export: can(user, "export", { type: "finance" }) },
  };
}

export async function invoicesView(user: SessionUser, leadId: string | null) {
  if (!can(user, "view", { type: "invoice" })) throw new NotFoundError();
  const today = isoDateIST();
  const [invoices, proformas, nextInvoice, nextProforma, users, prefill] = await Promise.all([
    listDocuments(user, ["INVOICE", "CREDIT_NOTE"]),
    listDocuments(user, ["PROFORMA"]),
    peekNumber("INVOICE", today),
    peekNumber("PROFORMA", today),
    activeUserOptions(),
    leadId ? invoicePrefill(user, leadId) : Promise.resolve(null),
  ]);
  return {
    invoices,
    proformas,
    nextInvoice,
    nextProforma,
    today,
    users,
    company: companyProfile(),
    prefill,
    can: { create: has(user, "invoices.create"), record: has(user, "finance.record"), creditNote: has(user, "invoices.credit_note") },
  };
}

export async function payrollView(user: SessionUser) {
  if (!can(user, "view", { type: "payroll" })) throw new NotFoundError();
  const manager = has(user, "payroll.view_all");
  // As on the web: people who only see their own pay use Payslips & Incentive.
  if (!manager && user.role !== "OWNER") return { redirect: "payslips" as const };
  const [run, next, employees] = await Promise.all([manager ? latestRun() : Promise.resolve(null), manager ? nextRunPeriod() : Promise.resolve(null), payrollEmployees(user)]);
  return { run, next, employees, manager, canRun: has(user, "payroll.run") };
}

export async function payslipsView(user: SessionUser) {
  // Partners are not on payroll.
  if (user.role === "OWNER") return { redirect: "payroll" as const };
  const today = isoDateIST();
  const [employees, incentive] = await Promise.all([payrollEmployees(user), incentiveFor(user.id, today)]);
  const me = employees.find((e) => e.id === user.id);
  if (!me) throw new NotFoundError();
  return { me, incentive, monthLabel: shortMonthLabel(today.slice(0, 7)) };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export async function teamsView(user: SessionUser) {
  if (!can(user, "view", { type: "team" })) throw new NotFoundError();
  const [summary, partners] = await Promise.all([teamSummary(user), listPartners()]);
  const { employees, admins, partners: partnerCount } = summary.counts;
  return {
    members: summary.members,
    partners: partners.map((p) => ({ id: p.id, name: p.name })),
    meta: `${plural(employees, "employee")} · ${plural(admins, "admin")} · ${plural(partnerCount, "partner")}`,
    quarterShort: summary.quarterShort,
    canManage: has(user, "teams.manage"),
    canSeeCtc: has(user, "payroll.view_all"),
    canMakeOwner: isOwner(user),
    canUploadDocs: has(user, "vault.employee_all"),
  };
}

function uploadLimits() {
  const e = env();
  return { maxMb: e.UPLOAD_MAX_MB, scanned: Boolean(e.CLAMAV_HOST) };
}

export async function vaultView(user: SessionUser) {
  const [folders, employees] = await Promise.all([vaultFolders(user), has(user, "vault.employee_all") ? activeUserOptions() : Promise.resolve(null)]);
  return { folders, employees, me: user.id, encrypted: storageEncrypted(), limits: uploadLimits() };
}

export async function vaultFolderView(user: SessionUser, slug: string) {
  const key = FOLDER_BY_SLUG[slug];
  if (!key) throw new NotFoundError();
  const folders = await vaultFolders(user);
  const folder = folders.find((f) => f.key === key);
  if (!folder) throw new NotFoundError();
  const [files, employees] = await Promise.all([vaultFiles(user, key), has(user, "vault.employee_all") ? activeUserOptions() : Promise.resolve(null)]);
  return { folder, files, employees, me: user.id, limits: uploadLimits() };
}

type SettingsTab = "general" | "roles" | "integrations" | "audit";

export async function settingsView(user: SessionUser, q: URLSearchParams) {
  if (!can(user, "view", { type: "settings" })) throw new NotFoundError();
  const tabs: SettingsTab[] = [
    ...(has(user, "settings.manage") ? (["general"] as const) : []),
    ...(isAdminOrOwner(user) ? (["roles"] as const) : []),
    ...(has(user, "settings.manage") ? (["integrations"] as const) : []),
    ...(has(user, "audit.view") ? (["audit"] as const) : []),
  ];
  const asked = q.get("tab");
  const tab = (tabs as string[]).includes(asked ?? "") ? (asked as SettingsTab) : tabs[0];
  if (!tab) throw new NotFoundError();

  if (tab === "general") {
    const today = isoDateIST();
    const current = fyOfIso(today).startYear;
    const fy = Number(q.get("fy")) || current;
    const qn = Number(q.get("q"));
    const quarter = ([1, 2, 3, 4].includes(qn) ? qn : fy === current ? fyQuarterOfIso(today).q : 1) as 1 | 2 | 3 | 4;
    const [company, targets] = await Promise.all([companyRows(), Math.abs(fy - current) <= 1 ? targetsView(fy, quarter) : Promise.resolve(null)]);
    return { tabs, tab, general: { company, preferences: preferenceRows(), targets, canEditTargets: can(user, "update", { type: "targets" }) } };
  }
  if (tab === "roles") return { tabs, tab, roles: { matrix: await rolesMatrix(), canEdit: isOwner(user) } };
  if (tab === "integrations") return { tabs, tab, integrations: { cards: integrationCards() } };
  const moduleParam = q.get("module");
  const auditModule = moduleParam && (AUDIT_MODULES as readonly string[]).includes(moduleParam) ? moduleParam : null;
  const page = await auditPage(user, auditModule, q.get("before"));
  return { tabs, tab, audit: { modules: AUDIT_MODULES, module: auditModule, rows: page.rows, next: page.next } };
}
