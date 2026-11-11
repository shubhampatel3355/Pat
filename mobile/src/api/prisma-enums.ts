/**
 * The database enums (prisma/schema.prisma) as string unions. The shared helpers in ../src/lib import their
 * types from "@/generated/prisma/enums", which this file stands in for (see tsconfig paths). The web
 * project's typecheck asserts these match the generated Prisma enums (tests/contract/mobile-api.ts).
 */
export type Role = "OWNER" | "ADMIN" | "EMPLOYEE";
export type AuthTokenType = "INVITE" | "PASSWORD_RESET" | "LOGIN_OTP";
export type PricingBasis = "PER_SQFT" | "PER_SEAT" | "LUMPSUM";
export type LandlordType = "LANDLORD" | "OPERATOR";
export type WipRemark = "VISITS" | "MEETINGS" | "FOLLOW_UP_MEETINGS" | "NEGOTIATIONS" | "ON_HOLD" | "LOST" | "INVOICE_RAISED" | "PAYMENT_COLLECTED";
export type BrokerRole = "PRIMARY" | "SECONDARY";
export type TaskPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type FollowUpType = "CALL" | "WHATSAPP" | "EMAIL" | "MEETING" | "SITE_VISIT";
export type MeetingType = "INTRODUCTION" | "REQUIREMENT" | "SITE_TOUR" | "PROPOSAL" | "FOLLOW_UP";
export type MeetingMode = "IN_PERSON" | "VIDEO_CALL" | "PHONE_CALL";
export type LeadTemperature = "COLD" | "LUKEWARM" | "WARM" | "HOT";
export type CarType = "SEDAN" | "SUV";
export type CabStatus = "REQUESTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
export type InvoiceType = "INVOICE" | "PROFORMA" | "CREDIT_NOTE";
export type InvoiceStatus = "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CREDITED" | "OPEN" | "CONVERTED" | "CANCELLED";
export type DocumentKind = "INVOICE" | "PROFORMA" | "CREDIT_NOTE";
export type PaymentMode = "NEFT" | "RTGS" | "IMPS" | "UPI" | "CHEQUE" | "CARD" | "CASH" | "OTHER";
export type LedgerType = "INCOME" | "EXPENSE";
export type PayrollRunStatus = "REVIEW" | "APPROVED" | "DISBURSED";
export type PayslipPeriodType = "MONTHLY" | "QUARTERLY" | "YEARLY";
export type FolderKey = "PM_DOCUMENTS" | "CLIENT_DOCUMENTS" | "EMPLOYEE_DOCUMENTS";
export type ScanStatus = "CLEAN" | "SKIPPED" | "INFECTED";
export type TargetScope = "COMPANY" | "PARTNER" | "USER";
export type TargetMetric = "REVENUE" | "WIP_FEES";
export type AchievementKind = "DEAL_CLOSED" | "TARGET_REACHED" | "MILESTONE";
export type AuditVisibility = "PUBLIC" | "RESTRICTED" | "PRIVATE";
