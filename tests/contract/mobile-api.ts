/**
 * Compile-time contract between the backend and the mobile app (mobile/src/api). Never executed: `pnpm typecheck`
 * fails when a server response or a database enum no longer matches what the app reads. Lives under tests/ so the
 * production Docker build (which doesn't copy mobile/) never sees it.
 */
import type * as Db from "@/generated/prisma/enums";
import type { LiveSnapshot } from "@/components/shell/live";
import type { bdView, dashboardView, financeView, followUpsView, invoicesView, meView, payrollView, payslipsView, settingsView, teamsView, vaultFolderView, vaultView, vehiclesView, wipView } from "@/server/mobile/views";
import type { fileDownloadUrl } from "@/server/services/files";
import type * as App from "../../mobile/src/api/prisma-enums";
import type * as Api from "../../mobile/src/api/types";

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Fits<Server, AppReads> = [Server] extends [AppReads] ? true : false;
type Expect<T extends true> = T;
type Out<F extends (...args: never[]) => unknown> = Awaited<ReturnType<F>>;

export type EnumsMatch = [
  Expect<Same<Db.Role, App.Role>>,
  Expect<Same<Db.AuthTokenType, App.AuthTokenType>>,
  Expect<Same<Db.PricingBasis, App.PricingBasis>>,
  Expect<Same<Db.LandlordType, App.LandlordType>>,
  Expect<Same<Db.WipRemark, App.WipRemark>>,
  Expect<Same<Db.BrokerRole, App.BrokerRole>>,
  Expect<Same<Db.TaskPriority, App.TaskPriority>>,
  Expect<Same<Db.TaskStatus, App.TaskStatus>>,
  Expect<Same<Db.FollowUpType, App.FollowUpType>>,
  Expect<Same<Db.MeetingType, App.MeetingType>>,
  Expect<Same<Db.MeetingMode, App.MeetingMode>>,
  Expect<Same<Db.LeadTemperature, App.LeadTemperature>>,
  Expect<Same<Db.CarType, App.CarType>>,
  Expect<Same<Db.CabStatus, App.CabStatus>>,
  Expect<Same<Db.InvoiceType, App.InvoiceType>>,
  Expect<Same<Db.InvoiceStatus, App.InvoiceStatus>>,
  Expect<Same<Db.DocumentKind, App.DocumentKind>>,
  Expect<Same<Db.PaymentMode, App.PaymentMode>>,
  Expect<Same<Db.LedgerType, App.LedgerType>>,
  Expect<Same<Db.PayrollRunStatus, App.PayrollRunStatus>>,
  Expect<Same<Db.PayslipPeriodType, App.PayslipPeriodType>>,
  Expect<Same<Db.FolderKey, App.FolderKey>>,
  Expect<Same<Db.ScanStatus, App.ScanStatus>>,
  Expect<Same<Db.TargetScope, App.TargetScope>>,
  Expect<Same<Db.TargetMetric, App.TargetMetric>>,
  Expect<Same<Db.AchievementKind, App.AchievementKind>>,
  Expect<Same<Db.AuditVisibility, App.AuditVisibility>>,
];

export type ResponsesFit = [
  Expect<Fits<Out<typeof meView> & { session: Api.SessionToken | null }, Api.MeResponse>>,
  Expect<Fits<LiveSnapshot, Api.LiveSnapshot>>,
  Expect<Fits<Out<typeof dashboardView>, Api.DashboardResponse>>,
  Expect<Fits<Out<typeof wipView>, Api.WipResponse>>,
  Expect<Fits<Out<typeof followUpsView>, Api.FollowUpsResponse>>,
  Expect<Fits<Out<typeof bdView>, Api.BdResponse>>,
  Expect<Fits<Out<typeof vehiclesView>, Api.VehiclesResponse>>,
  Expect<Fits<Out<typeof financeView>, Api.FinanceResponse>>,
  Expect<Fits<Out<typeof invoicesView>, Api.InvoicesResponse>>,
  Expect<Fits<Out<typeof payrollView>, Api.PayrollResponse>>,
  Expect<Fits<Out<typeof payslipsView>, Api.PayslipsResponse>>,
  Expect<Fits<Out<typeof teamsView>, Api.TeamsResponse>>,
  Expect<Fits<Out<typeof vaultView>, Api.VaultResponse>>,
  Expect<Fits<Out<typeof vaultFolderView>, Api.VaultFolderResponse>>,
  Expect<Fits<Out<typeof settingsView>, Api.SettingsResponse>>,
  Expect<Fits<NonNullable<Out<typeof fileDownloadUrl>>, Api.FileLink>>,
];
