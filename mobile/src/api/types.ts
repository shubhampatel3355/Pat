/**
 * JSON returned by the backend (src/app/api/mobile/v1 and the shared /api endpoints). These mirror the
 * server's DTOs in src/server/services; tests/contract/mobile-api.ts (run by the web's `pnpm typecheck`)
 * fails if the two drift apart. Amounts are integer paise; dates are "YYYY-MM-DD"; instants are ISO strings.
 * Keep this file free of imports other than ./prisma-enums so the web project can type-check it.
 */
import type {
  CabStatus,
  CarType,
  FolderKey,
  FollowUpType,
  InvoiceStatus,
  InvoiceType,
  LandlordType,
  LeadTemperature,
  LedgerType,
  MeetingMode,
  MeetingType,
  PaymentMode,
  PayrollRunStatus,
  PricingBasis,
  Role,
  TaskPriority,
  TaskStatus,
  WipRemark,
} from "./prisma-enums";

export type ActionResult<T = undefined> = { ok: true; message?: string; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

// ── Auth ──────────────────────────────────────────────────────────────────

export interface SessionToken {
  token: string;
  expiresAt: string;
}

export type LoginResponse =
  | ({ ok: true; mustChangePassword: boolean } & SessionToken)
  | { ok: false; error: string; otpRequired?: boolean; otpSentTo?: string };

export type PasswordChangeResponse = ActionResult & { session?: SessionToken };

// ── Me / shell ────────────────────────────────────────────────────────────

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface PartnerOption {
  id: string;
  name: string;
  initials: string;
}

export interface MeResponse {
  user: { id: string; name: string; firstName: string; initials: string; email: string; role: Role; title: string | null; mustChangePassword: boolean };
  perms: string[];
  nav: NavGroup[];
  quickCreate: { label: string; icon: string; href: string }[];
  partners: PartnerOption[];
  company: { shortName: string; legalName: string };
  appUrl: string;
  today: string;
  now: string;
  session: SessionToken | null;
}

export interface LiveNotification {
  id: string;
  text: string;
  href: string | null;
  at: string;
  read: boolean;
}

export interface LiveActivity {
  id: string;
  initials: string;
  who: string;
  text: string;
  module: string;
  at: string;
}

export interface LiveAchievement {
  id: string;
  title: string;
  meta: string | null;
  value: string | null;
  at: string;
}

export interface LiveSnapshot {
  unread: number;
  notifications: LiveNotification[];
  activity: LiveActivity[];
  newAchievements: LiveAchievement[];
}

export interface SearchResponse {
  groups: { label: string; items: { label: string; meta: string; href: string; icon: string }[] }[];
}

// ── Shared shapes ─────────────────────────────────────────────────────────

export interface Person {
  id: string;
  name: string;
  initials: string;
}

export interface UserOption {
  id: string;
  name: string;
  initials: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export interface TodoDto {
  id: string;
  text: string;
  dueDate: string | null;
  dueTime: string | null;
  important: boolean;
  remind: boolean;
  note: string;
  done: boolean;
}

export interface AchievementDto {
  id: string;
  kind: "DEAL_CLOSED" | "TARGET_REACHED" | "MILESTONE";
  title: string;
  meta: string;
  valuePaise: number | null;
}

export interface PipelineStage {
  remark: WipRemark;
  label: string;
  color: string;
  paise: number;
  count: number;
}

export interface EmployeeDayItem {
  id: string;
  kind: "LEAD" | "CAB";
  title: string;
  sub: string;
  date: string;
  time: string | null;
  href: string;
}

export interface DashboardData {
  mode: "company" | "partner" | "employee";
  today: string;
  viewLabel: string;
  target: { label: string; amountPaise: number | null; achievedPaise: number; note: string; scope: string };
  revenue: {
    ytdLabel: string;
    ytdPaise: number;
    yoyPct: number | null;
    fyLabel: string;
    projectedPaise: number;
    previous: { key: string; label: string; valuePaise: number }[];
  } | null;
  pipeline: { totalPaise: number; open: number; stages: PipelineStage[] } | null;
  todos: TodoDto[];
  achievements: AchievementDto[];
  canOpenFinance: boolean;
  employee?: {
    wip: { feesInPlayPaise: number; mandates: number; rows: { id: string; tenantName: string; building: string; feePaise: number; remark: WipRemark }[] };
    day: EmployeeDayItem[];
    pay: { earnedPaise: number; expectedPaise: number; ctcAnnualPaise: number | null; dateOfJoining: string | null; latestPayslip: { url: string; label: string } | null };
  };
}

export interface DashboardResponse {
  data: DashboardData;
  greeting: string;
  dateLabel: string;
  view: { value: string; canSwitch: boolean; partners: PartnerOption[] };
}

// ── WIP ───────────────────────────────────────────────────────────────────

export interface BrokerChip {
  userId: string | null;
  name: string;
  initials: string;
}

export interface WipRow {
  id: string;
  sl: number;
  tenantName: string;
  initials: string;
  pricingBasis: PricingBasis;
  areaSqft: number | null;
  seats: number | null;
  ratePaise: number;
  monthlyRentPaise: number;
  building: string;
  location: string;
  landlordType: LandlordType;
  landlordName: string;
  estFeesPaise: number;
  closureDate: string;
  remark: WipRemark;
  primary: BrokerChip[];
  secondary: BrokerChip[];
  canEdit: boolean;
  canDelete: boolean;
}

export interface WipResponse {
  rows: WipRow[];
  cards: { quarterLabel: string; currentPaise: number; mandates: number; targetPaise: number | null };
  users: UserOption[];
  me: string;
  today: string;
  monthEnd: string;
  defaultClosure: string;
  canCreate: boolean;
  canInvoice: boolean;
}

// ── Follow-ups & tasks ────────────────────────────────────────────────────

export interface TaskComment {
  id: string;
  author: Person;
  body: string;
  at: string;
}

export interface TaskDto {
  id: string;
  title: string;
  assignee: Person;
  createdBy: string;
  dueAt: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  lead: { id: string; name: string } | null;
  reminders: { inApp: boolean; email: boolean; whatsapp: boolean };
  comments: TaskComment[];
  canEdit: boolean;
  canDelete: boolean;
}

export interface FollowUpDto {
  id: string;
  contactName: string;
  type: FollowUpType;
  note: string;
  owner: Person;
  dueAt: string;
  lead: { id: string; name: string } | null;
  canEdit: boolean;
}

export interface FollowUpsResponse {
  followUps: FollowUpDto[];
  tasks: TaskDto[];
  users: UserOption[];
  leads: { id: string; name: string }[];
  me: string;
  today: string;
  now: string;
}

// ── Business development ──────────────────────────────────────────────────

export interface BdRow {
  id: string;
  primary: Person;
  secondary: Person | null;
  date: string;
  tenantName: string;
  contactName: string;
  designation: string | null;
  contact: { phone: string | null; email: string | null } | null;
  meetingType: MeetingType;
  temperature: LeadTemperature;
  mode: MeetingMode;
  comments: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface BdResponse {
  rows: BdRow[];
  users: UserOption[];
  me: string;
  today: string;
  canSeeContacts: boolean;
}

// ── Vehicles ──────────────────────────────────────────────────────────────

export interface CabRow {
  id: string;
  bookedFor: { id: string; name: string; initials: string; role: string };
  clientName: string;
  carType: CarType;
  date: string;
  time: string;
  pickupLocation: string;
  bookedOn: string;
  status: CabStatus;
  canConfirm: boolean;
  canComplete: boolean;
  canCancel: boolean;
}

export interface VehiclesResponse {
  rows: CabRow[];
  stats: { today: number; upcoming: number; all: number };
  people: { id: string; label: string }[];
  places: string[];
  me: string;
  today: string;
  defaultPickup: { date: string; time: string };
}

// ── Finance ───────────────────────────────────────────────────────────────

export interface FinancialYearInfo {
  startYear: number;
  short: string;
  label: string;
  key: string;
  start: string;
  end: string;
}

export interface MonthPoint {
  month: string;
  label: string;
  paise: number;
}

export interface ReceivableRow {
  id: string;
  number: string;
  payeeName: string;
  issueDate: string;
  dueDate: string | null;
  totalPaise: number;
  paidPaise: number;
  creditedPaise: number;
  outstandingPaise: number;
  daysOverdue: number;
  bucket: 0 | 1 | 2 | 3;
}

export interface FinanceOverview {
  period: { fy: FinancialYearInfo; toDate: boolean; from: string; to: string; label: string; prevFrom: string; prevTo: string };
  billing: { invoiceCount: number; invoiceFeesPaise: number; invoiceTotalPaise: number; creditCount: number; creditFeesPaise: number; creditTotalPaise: number };
  revenue: { paise: number; prevPaise: number; months: MonthPoint[] };
  otherIncomePaise: number;
  incomeByCategory: { category: string; paise: number }[];
  expenses: { paise: number; prevPaise: number; byCategory: { category: string; paise: number }[]; months: MonthPoint[] };
  profit: { paise: number; prevPaise: number; marginPct: number | null };
  collections: { paise: number; prevPaise: number; months: MonthPoint[] };
  payroll: { paise: number; prevPaise: number; months: MonthPoint[]; pctOfRevenue: number | null };
  receivables: {
    open: ReceivableRow[];
    outstandingPaise: number;
    overduePaise: number;
    overdueCount: number;
    ageing: { label: string; paise: number; count: number }[];
    billedPaise: number;
    collectedPaise: number;
    collectedPct: number | null;
  };
}

export interface LedgerRow {
  id: string;
  type: LedgerType;
  date: string;
  description: string;
  category: string;
  party: string | null;
  mode: PaymentMode;
  amountPaise: number;
  source: "payment" | "payroll" | "manual";
  recordedBy: string;
}

export interface FinanceResponse {
  fy: number;
  years: { value: number; label: string }[];
  periodLabel: string;
  overview: FinanceOverview;
  entries: LedgerRow[];
  today: string;
  can: { record: boolean; export: boolean };
}

// ── Invoices ──────────────────────────────────────────────────────────────

export interface InvoiceDocData {
  kind: "INVOICE" | "PROFORMA" | "CREDIT_NOTE";
  number: string;
  draft: boolean;
  date: string;
  validUntil: string | null;
  dueDate: string | null;
  payeeName: string;
  billingAddress: string;
  gstin: string;
  placeOfSupply: string;
  contact: string;
  paymentTerms: string;
  narration: string;
  fees: string;
  lines: { label: string; value: string; strong?: boolean }[];
  brokers: { name: string; pct: number }[];
  reference: string | null;
}

export interface InvoiceRow {
  id: string;
  type: InvoiceType;
  number: string;
  payeeName: string;
  narration: string;
  gstin: string;
  paymentTerms: string;
  totalPaise: number;
  outstandingPaise: number;
  issueDate: string;
  validUntil: string | null;
  status: { label: string; color: string };
  rawStatus: InvoiceStatus;
  convertedToNumber: string | null;
  doc: InvoiceDocData;
  email: string;
  files: { id: string; name: string; sizeBytes: number }[];
  creditablePaise: number;
  payments: { id: string; amountPaise: number; receivedOn: string; mode: string; reference: string | null; recordedBy: string }[];
}

export interface CompanyProfile {
  legalName: string;
  shortName: string;
  address: string;
  gstin: string;
  pan: string | null;
  rera: string;
  phone: string;
  email: string;
  website: string;
  sac: string;
  bank: { name: string; accountName: string; accountNumber: string; ifsc: string; branch: string | null } | null;
  signatory: { name: string; title: string };
}

export interface InvoicePrefill {
  leadId: string;
  leadName: string;
  payeeName: string;
  narration: string;
  feesRupees: string;
  brokers: ({ kind: "user"; userId: string; pct: string } | { kind: "external"; name: string; pct: string })[];
}

export interface InvoicesResponse {
  invoices: InvoiceRow[];
  proformas: InvoiceRow[];
  nextInvoice: string;
  nextProforma: string;
  today: string;
  users: UserOption[];
  company: CompanyProfile;
  prefill: InvoicePrefill | null;
  can: { create: boolean; record: boolean; creditNote: boolean };
}

// ── Payroll ───────────────────────────────────────────────────────────────

export interface PayslipComponents {
  basic: number;
  hra: number;
  special: number;
  commission: number;
  incentive: number;
  pf: number;
  pt: number;
  tds: number;
  other: number;
  daysInMonth: number;
  daysPaid: number;
  tdsOverridden?: boolean;
  note?: string;
}

export interface PayrollPerson {
  id: string;
  name: string;
  initials: string;
  title: string;
}

export interface PayslipRow {
  id: string;
  user: PayrollPerson;
  components: PayslipComponents;
  totals: { gross: number; deductions: number; net: number };
  onHold: boolean;
}

export interface PayrollRun {
  id: string;
  period: string;
  label: string;
  status: PayrollRunStatus;
  payDate: string;
  openedOn: string;
  approved: { on: string; by: string } | null;
  disbursed: { on: string; by: string } | null;
  payslips: PayslipRow[];
  totals: { net: number; commission: number; deductions: number; live: number; held: number };
}

export type StatementType = "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface PayrollEmployee extends PayrollPerson {
  dateOfJoining: string | null;
  ctcAnnualPaise: number | null;
  statements: Record<StatementType, { key: string; label: string }[]>;
}

export type PayrollResponse =
  | { redirect: "payslips" }
  | { run: PayrollRun | null; next: { period: string; payDate: string } | null; employees: PayrollEmployee[]; manager: boolean; canRun: boolean };

export interface IncentiveRow {
  leadId: string;
  tenantName: string;
  building: string;
  remark: WipRemark;
  feePaise: number;
  sharePct: number;
  incentivePaise: number;
  status: "EARNED" | "EXPECTED" | "NO_PAYOUT";
}

export type PayslipsResponse =
  | { redirect: "payroll" }
  | { me: PayrollEmployee; incentive: { fyLabel: string; rows: IncentiveRow[]; earnedPaise: number; expectedPaise: number }; monthLabel: string };

// ── Teams ─────────────────────────────────────────────────────────────────

export interface Member {
  id: string;
  name: string;
  initials: string;
  title: string;
  role: Role;
  email: string;
  phone: string;
  partnerId: string | null;
  partnerName: string | null;
  dateOfJoining: string | null;
  ctcAnnualPaise: number | null;
  status: "ACTIVE" | "INVITED" | "INACTIVE";
  achievedPaise: number;
  targetPaise: number | null;
  canEdit: boolean;
}

export interface TeamsResponse {
  members: Member[];
  partners: { id: string; name: string }[];
  meta: string;
  quarterShort: string;
  canManage: boolean;
  canSeeCtc: boolean;
  canMakeOwner: boolean;
  canUploadDocs: boolean;
}

// ── Vault ─────────────────────────────────────────────────────────────────

export interface FolderCard {
  key: FolderKey;
  slug: string;
  name: string;
  count: number;
  sizeBytes: number;
  updated: string | null;
}

export interface FileRow {
  id: string;
  name: string;
  ext: string;
  sizeBytes: number;
  mime: string;
  uploadedAt: string;
  uploadedBy: string;
  ownerName: string | null;
  canDelete: boolean;
}

export interface VaultResponse {
  folders: FolderCard[];
  employees: UserOption[] | null;
  me: string;
  encrypted: boolean;
  limits: { maxMb: number; scanned: boolean };
}

export interface VaultFolderResponse {
  folder: FolderCard;
  files: FileRow[];
  employees: UserOption[] | null;
  me: string;
  limits: { maxMb: number; scanned: boolean };
}

export interface UploadResponse {
  files: FileRow[];
  errors: string[];
}

// ── Settings ──────────────────────────────────────────────────────────────

export type SettingsTab = "general" | "roles" | "integrations" | "audit";

export interface InfoRow {
  k: string;
  v: string;
}

export interface TargetsView {
  fy: FinancialYearInfo;
  quarter: 1 | 2 | 3 | 4;
  quarterLabel: string;
  fyOptions: { value: number; label: string }[];
  company: { revenue: number | null; wipFees: number | null };
  partners: { id: string; name: string; revenue: number | null }[];
  members: { id: string; name: string; initials: string; title: string; revenue: number | null; wipFees: number | null }[];
}

export interface RolesMatrix {
  roles: { role: Role; label: string; users: number }[];
  groups: { group: "Sell" | "Operate" | "Money" | "People" | "Admin"; rows: { key: string; label: string; description: string; admin: boolean; employee: boolean }[] }[];
}

export interface IntegrationCard {
  mono: string;
  name: string;
  kind: string;
  description: string;
  status: "Connected" | "Development" | "Off" | "Not configured" | "Coming soon";
  detail: string;
}

export interface AuditRow {
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

export interface SettingsResponse {
  tabs: SettingsTab[];
  tab: SettingsTab;
  general?: { company: InfoRow[]; preferences: InfoRow[]; targets: TargetsView | null; canEditTargets: boolean };
  roles?: { matrix: RolesMatrix; canEdit: boolean };
  integrations?: { cards: IntegrationCard[] };
  audit?: { modules: readonly string[]; module: string | null; rows: AuditRow[]; next: string | null };
}

export interface FileLink {
  url: string;
  name: string;
  mime: string;
}
