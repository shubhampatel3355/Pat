-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('INVITE', 'PASSWORD_RESET', 'LOGIN_OTP');

-- CreateEnum
CREATE TYPE "PricingBasis" AS ENUM ('PER_SQFT', 'PER_SEAT', 'LUMPSUM');

-- CreateEnum
CREATE TYPE "LandlordType" AS ENUM ('LANDLORD', 'OPERATOR');

-- CreateEnum
CREATE TYPE "WipRemark" AS ENUM ('VISITS', 'MEETINGS', 'FOLLOW_UP_MEETINGS', 'NEGOTIATIONS', 'ON_HOLD', 'LOST', 'INVOICE_RAISED', 'PAYMENT_COLLECTED');

-- CreateEnum
CREATE TYPE "BrokerRole" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "FollowUpType" AS ENUM ('CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'SITE_VISIT');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('INTRODUCTION', 'REQUIREMENT', 'SITE_TOUR', 'PROPOSAL', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "MeetingMode" AS ENUM ('IN_PERSON', 'VIDEO_CALL', 'PHONE_CALL');

-- CreateEnum
CREATE TYPE "LeadTemperature" AS ENUM ('COLD', 'LUKEWARM', 'WARM', 'HOT');

-- CreateEnum
CREATE TYPE "CarType" AS ENUM ('SEDAN', 'SUV');

-- CreateEnum
CREATE TYPE "CabStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('INVOICE', 'PROFORMA', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'CREDITED', 'OPEN', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('INVOICE', 'PROFORMA', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('NEFT', 'RTGS', 'IMPS', 'UPI', 'CHEQUE', 'CARD', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('REVIEW', 'APPROVED', 'DISBURSED');

-- CreateEnum
CREATE TYPE "PayslipPeriodType" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "FolderKey" AS ENUM ('PM_DOCUMENTS', 'CLIENT_DOCUMENTS', 'EMPLOYEE_DOCUMENTS');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('CLEAN', 'SKIPPED', 'INFECTED');

-- CreateEnum
CREATE TYPE "TargetScope" AS ENUM ('COMPANY', 'PARTNER', 'USER');

-- CreateEnum
CREATE TYPE "TargetMetric" AS ENUM ('REVENUE', 'WIP_FEES');

-- CreateEnum
CREATE TYPE "AchievementKind" AS ENUM ('DEAL_CLOSED', 'TARGET_REACHED', 'MILESTONE');

-- CreateEnum
CREATE TYPE "AuditVisibility" AS ENUM ('PUBLIC', 'RESTRICTED', 'PRIVATE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "title" TEXT,
    "partner_id" UUID,
    "date_of_joining" DATE,
    "ctc_annual_paise" BIGINT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "password_hash" TEXT,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMPTZ(3),
    "achievements_seen_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "role" "Role" NOT NULL,
    "key" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("role","key")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key","window_start")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "serial" SERIAL NOT NULL,
    "tenant_name" TEXT NOT NULL,
    "pricing_basis" "PricingBasis" NOT NULL,
    "area_sqft" INTEGER,
    "seats" INTEGER,
    "rate_paise" BIGINT NOT NULL,
    "building" TEXT,
    "location" TEXT NOT NULL,
    "landlord_type" "LandlordType" NOT NULL DEFAULT 'LANDLORD',
    "landlord_name" TEXT,
    "est_fees_paise" BIGINT NOT NULL,
    "closure_date" DATE NOT NULL,
    "remark" "WipRemark" NOT NULL DEFAULT 'VISITS',
    "remark_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_brokers" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "role" "BrokerRole" NOT NULL,
    "user_id" UUID,
    "external_name" TEXT,
    "share_pct" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_brokers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "assignee_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "due_at" TIMESTAMPTZ(3),
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "lead_id" UUID,
    "remind_in_app" BOOLEAN NOT NULL DEFAULT true,
    "remind_email" BOOLEAN NOT NULL DEFAULT false,
    "remind_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" UUID NOT NULL,
    "lead_id" UUID,
    "contact_name" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "type" "FollowUpType" NOT NULL,
    "note" TEXT,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todos" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "due_date" DATE,
    "due_time" TEXT,
    "important" BOOLEAN NOT NULL DEFAULT false,
    "remind" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "done_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bd_meetings" (
    "id" UUID NOT NULL,
    "primary_broker_id" UUID NOT NULL,
    "secondary_broker_id" UUID,
    "meeting_date" DATE NOT NULL,
    "tenant_name" TEXT NOT NULL,
    "sector" TEXT,
    "contact_name" TEXT NOT NULL,
    "designation" TEXT,
    "client_phone_enc" TEXT,
    "client_email_enc" TEXT,
    "meeting_type" "MeetingType" NOT NULL,
    "temperature" "LeadTemperature" NOT NULL,
    "mode" "MeetingMode" NOT NULL,
    "comments" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "bd_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cab_bookings" (
    "id" UUID NOT NULL,
    "car_type" "CarType" NOT NULL,
    "client_name" TEXT NOT NULL,
    "pickup_date" DATE NOT NULL,
    "pickup_time" TEXT NOT NULL,
    "pickup_location" TEXT NOT NULL,
    "booked_for_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "status" "CabStatus" NOT NULL DEFAULT 'REQUESTED',
    "status_changed_by_id" UUID,
    "status_changed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cab_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "number" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE,
    "valid_until" DATE,
    "payee_name" TEXT NOT NULL,
    "billing_address" TEXT NOT NULL,
    "gstin" TEXT,
    "place_of_supply" TEXT NOT NULL,
    "narration" TEXT,
    "payment_terms" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fees_paise" BIGINT NOT NULL,
    "cgst_paise" BIGINT NOT NULL DEFAULT 0,
    "sgst_paise" BIGINT NOT NULL DEFAULT 0,
    "igst_paise" BIGINT NOT NULL DEFAULT 0,
    "total_paise" BIGINT NOT NULL,
    "amount_paid_paise" BIGINT NOT NULL DEFAULT 0,
    "lead_id" UUID,
    "converted_from_id" UUID,
    "credit_note_for_id" UUID,
    "reason" TEXT,
    "pdf_key" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_brokers" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "user_id" UUID,
    "external_name" TEXT,
    "share_pct" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoice_brokers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "kind" "DocumentKind" NOT NULL,
    "fy" TEXT NOT NULL,
    "next_value" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("kind","fy")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "received_on" DATE NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "type" "LedgerType" NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "party" TEXT,
    "mode" "PaymentMode" NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "entry_date" DATE NOT NULL,
    "payment_id" UUID,
    "payroll_run_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'REVIEW',
    "pay_date" DATE NOT NULL,
    "created_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "disbursed_by_id" UUID,
    "disbursed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "period_type" "PayslipPeriodType" NOT NULL DEFAULT 'MONTHLY',
    "gross_paise" BIGINT NOT NULL,
    "deductions_paise" BIGINT NOT NULL,
    "net_paise" BIGINT NOT NULL,
    "components" JSONB NOT NULL,
    "on_hold" BOOLEAN NOT NULL DEFAULT false,
    "pdf_key" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" UUID NOT NULL,
    "key" "FolderKey" NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "folder_id" UUID,
    "name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "owner_user_id" UUID,
    "invoice_id" UUID,
    "uploaded_by_id" UUID NOT NULL,
    "scan_status" "ScanStatus" NOT NULL DEFAULT 'SKIPPED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "targets" (
    "id" UUID NOT NULL,
    "scope" "TargetScope" NOT NULL,
    "scope_key" TEXT NOT NULL,
    "metric" "TargetMetric" NOT NULL,
    "period" TEXT NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" UUID NOT NULL,
    "kind" "AchievementKind" NOT NULL,
    "user_id" UUID,
    "lead_id" UUID,
    "invoice_id" UUID,
    "title" TEXT NOT NULL,
    "meta" TEXT,
    "value_paise" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "href" TEXT,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "text" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "before" JSONB,
    "after" JSONB,
    "visibility" "AuditVisibility" NOT NULL DEFAULT 'PRIVATE',
    "subject_user_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "feed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_active_idx" ON "users"("role", "active");

-- CreateIndex
CREATE INDEX "users_partner_id_idx" ON "users"("partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_type_idx" ON "auth_tokens"("user_id", "type");

-- CreateIndex
CREATE INDEX "rate_limits_window_start_idx" ON "rate_limits"("window_start");

-- CreateIndex
CREATE UNIQUE INDEX "leads_serial_key" ON "leads"("serial");

-- CreateIndex
CREATE INDEX "leads_remark_idx" ON "leads"("remark");

-- CreateIndex
CREATE INDEX "leads_closure_date_idx" ON "leads"("closure_date");

-- CreateIndex
CREATE INDEX "leads_deleted_at_idx" ON "leads"("deleted_at");

-- CreateIndex
CREATE INDEX "lead_brokers_user_id_idx" ON "lead_brokers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_brokers_lead_id_user_id_key" ON "lead_brokers"("lead_id", "user_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_status_idx" ON "tasks"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "tasks_due_at_idx" ON "tasks"("due_at");

-- CreateIndex
CREATE INDEX "task_comments_task_id_created_at_idx" ON "task_comments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "follow_ups_owner_id_due_at_idx" ON "follow_ups"("owner_id", "due_at");

-- CreateIndex
CREATE INDEX "todos_user_id_done_idx" ON "todos"("user_id", "done");

-- CreateIndex
CREATE INDEX "bd_meetings_meeting_date_idx" ON "bd_meetings"("meeting_date");

-- CreateIndex
CREATE INDEX "bd_meetings_primary_broker_id_idx" ON "bd_meetings"("primary_broker_id");

-- CreateIndex
CREATE INDEX "bd_meetings_secondary_broker_id_idx" ON "bd_meetings"("secondary_broker_id");

-- CreateIndex
CREATE INDEX "cab_bookings_pickup_date_idx" ON "cab_bookings"("pickup_date");

-- CreateIndex
CREATE INDEX "cab_bookings_booked_for_id_idx" ON "cab_bookings"("booked_for_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_converted_from_id_key" ON "invoices"("converted_from_id");

-- CreateIndex
CREATE INDEX "invoices_type_issue_date_idx" ON "invoices"("type", "issue_date");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_type_fy_seq_key" ON "invoices"("type", "fy", "seq");

-- CreateIndex
CREATE INDEX "invoice_brokers_invoice_id_idx" ON "invoice_brokers"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_brokers_user_id_idx" ON "invoice_brokers"("user_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_received_on_idx" ON "payments"("received_on");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_payment_id_key" ON "ledger_entries"("payment_id");

-- CreateIndex
CREATE INDEX "ledger_entries_type_entry_date_idx" ON "ledger_entries"("type", "entry_date");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_period_key" ON "payroll_runs"("period");

-- CreateIndex
CREATE INDEX "payslips_run_id_idx" ON "payslips"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_user_id_period_period_type_key" ON "payslips"("user_id", "period", "period_type");

-- CreateIndex
CREATE UNIQUE INDEX "folders_key_key" ON "folders"("key");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE INDEX "files_folder_id_deleted_at_idx" ON "files"("folder_id", "deleted_at");

-- CreateIndex
CREATE INDEX "files_owner_user_id_idx" ON "files"("owner_user_id");

-- CreateIndex
CREATE INDEX "files_invoice_id_idx" ON "files"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "targets_scope_scope_key_metric_period_key" ON "targets"("scope", "scope_key", "metric", "period");

-- CreateIndex
CREATE INDEX "achievements_created_at_idx" ON "achievements"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_module_created_at_idx" ON "audit_logs"("module", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_feed_created_at_idx" ON "audit_logs"("feed", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_subject_user_ids_idx" ON "audit_logs" USING GIN ("subject_user_ids");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_brokers" ADD CONSTRAINT "lead_brokers_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_brokers" ADD CONSTRAINT "lead_brokers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bd_meetings" ADD CONSTRAINT "bd_meetings_primary_broker_id_fkey" FOREIGN KEY ("primary_broker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bd_meetings" ADD CONSTRAINT "bd_meetings_secondary_broker_id_fkey" FOREIGN KEY ("secondary_broker_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bd_meetings" ADD CONSTRAINT "bd_meetings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cab_bookings" ADD CONSTRAINT "cab_bookings_booked_for_id_fkey" FOREIGN KEY ("booked_for_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cab_bookings" ADD CONSTRAINT "cab_bookings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cab_bookings" ADD CONSTRAINT "cab_bookings_status_changed_by_id_fkey" FOREIGN KEY ("status_changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_converted_from_id_fkey" FOREIGN KEY ("converted_from_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_credit_note_for_id_fkey" FOREIGN KEY ("credit_note_for_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_brokers" ADD CONSTRAINT "invoice_brokers_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_brokers" ADD CONSTRAINT "invoice_brokers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_disbursed_by_id_fkey" FOREIGN KEY ("disbursed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Integrity rules Prisma cannot express ───────────────────────────────────

-- A broker is either a team member or an external name, never both / neither.
ALTER TABLE "lead_brokers" ADD CONSTRAINT "lead_brokers_user_xor_external"
  CHECK ((("user_id" IS NOT NULL)::int + (NULLIF(btrim("external_name"), '') IS NOT NULL)::int) = 1);
ALTER TABLE "invoice_brokers" ADD CONSTRAINT "invoice_brokers_user_xor_external"
  CHECK ((("user_id" IS NOT NULL)::int + (NULLIF(btrim("external_name"), '') IS NOT NULL)::int) = 1);
ALTER TABLE "lead_brokers" ADD CONSTRAINT "lead_brokers_share_pct_range" CHECK ("share_pct" IS NULL OR "share_pct" BETWEEN 0 AND 100);
ALTER TABLE "invoice_brokers" ADD CONSTRAINT "invoice_brokers_share_pct_range" CHECK ("share_pct" BETWEEN 0 AND 100);

-- Money is never negative (credit notes store positive amounts and are typed CREDIT_NOTE).
ALTER TABLE "leads" ADD CONSTRAINT "leads_amounts_non_negative" CHECK ("rate_paise" >= 0 AND "est_fees_paise" >= 0);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amounts_non_negative"
  CHECK ("fees_paise" >= 0 AND "cgst_paise" >= 0 AND "sgst_paise" >= 0 AND "igst_paise" >= 0 AND "total_paise" >= 0 AND "amount_paid_paise" >= 0);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_total_matches" CHECK ("total_paise" = "fees_paise" + "cgst_paise" + "sgst_paise" + "igst_paise");
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount_paise" > 0);
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_amount_positive" CHECK ("amount_paise" > 0);
ALTER TABLE "users" ADD CONSTRAINT "users_ctc_non_negative" CHECK ("ctc_annual_paise" IS NULL OR "ctc_annual_paise" >= 0);
ALTER TABLE "targets" ADD CONSTRAINT "targets_amount_non_negative" CHECK ("amount_paise" >= 0);

-- Shape checks
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_gstin_format" CHECK ("gstin" IS NULL OR "gstin" ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');
ALTER TABLE "cab_bookings" ADD CONSTRAINT "cab_bookings_time_format" CHECK ("pickup_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "todos" ADD CONSTRAINT "todos_time_format" CHECK ("due_time" IS NULL OR "due_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_period_format" CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
