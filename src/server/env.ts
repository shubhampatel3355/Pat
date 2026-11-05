import "server-only";
import { z } from "zod";

/**
 * Runtime environment, validated once on first access (and eagerly at server boot from
 * instrumentation.ts) so the process fails fast with a readable list of problems.
 * Validation is lazy so `next build` does not need production secrets.
 */

const bool = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0", "yes", "no", ""])
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : ["true", "1", "yes"].includes(v)));

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url(),
    PORT: z.coerce.number().int().positive().default(3000),
    INTERNAL_APP_URL: optionalString,
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    DATABASE_URL: z.string().min(1).startsWith("postgres"),
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    SLOW_QUERY_MS: z.coerce.number().int().positive().default(500),

    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)"),
    AUTH_GOOGLE_ID: optionalString,
    AUTH_GOOGLE_SECRET: optionalString,
    AUTH_SESSION_HOURS: z.coerce.number().int().positive().default(12),
    AUTH_REMEMBER_DAYS: z.coerce.number().int().positive().default(30),
    AUTH_OTP_FOR_ADMINS: bool(false),

    ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, "base64").length === 32, "ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)"),

    STORAGE_DRIVER: z.enum(["s3", "local"]).default("s3"),
    S3_ENDPOINT: optionalString,
    /** Address browsers use for presigned download links when S3_ENDPOINT is internal (e.g. http://minio:9000). */
    S3_PUBLIC_ENDPOINT: optionalString,
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: optionalString,
    S3_ACCESS_KEY_ID: optionalString,
    S3_SECRET_ACCESS_KEY: optionalString,
    S3_FORCE_PATH_STYLE: bool(true),
    /** Server-side encryption for uploads ("AES256" = SSE-S3; MinIO needs KMS configured, see docs/DEPLOY.md). */
    S3_SSE: z.enum(["", "AES256"]).default(""),
    UPLOAD_MAX_MB: z.coerce.number().positive().max(100).default(25),

    MAIL_DRIVER: z.enum(["smtp", "file"]).default("smtp"),
    MAIL_FROM: z.string().default("Pat Michaels OS <no-reply@patmichaels.in>"),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: bool(false),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,

    COMPANY_LEGAL_NAME: z.string().default("Pat Michaels Developers LLP"),
    COMPANY_SHORT_NAME: z.string().default("Pat Michaels"),
    COMPANY_GSTIN: z.string().default("29AAKFP4821L1ZR"),
    COMPANY_PAN: optionalString,
    COMPANY_RERA: z.string().default("PRM/KA/RERA/1251/310/AG/220415/002938"),
    COMPANY_ADDRESS: z.string().default("14, Lavelle Road, Bengaluru 560001"),
    COMPANY_PHONE: z.string().default("+91 80 4718 2200"),
    COMPANY_EMAIL: z.string().default("accounts@patmichaels.in"),
    COMPANY_WEBSITE: z.string().default("patmichaels.in"),
    COMPANY_BANK_NAME: optionalString,
    COMPANY_BANK_ACCOUNT_NAME: optionalString,
    COMPANY_BANK_ACCOUNT_NUMBER: optionalString,
    COMPANY_BANK_IFSC: optionalString,
    COMPANY_BANK_BRANCH: optionalString,
    /** GST services accounting code printed on invoices (9972 = real estate services). */
    COMPANY_SAC_CODE: z.string().regex(/^\d{4,8}$/).default("9972"),
    COMPANY_SIGNATORY_NAME: z.string().default("Pat Michaels"),
    COMPANY_SIGNATORY_TITLE: z.string().default("Designated Partner"),

    CHROMIUM_PATH: optionalString,
    CLAMAV_HOST: optionalString,
    CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
    SENTRY_DSN: optionalString,

    /** Comma-separated feature flags, e.g. "integrations-preview" shows planned integrations in Settings. */
    FEATURES: z
      .string()
      .default("")
      .transform((s) => new Set(s.split(",").map((f) => f.trim()).filter(Boolean))),
    WORKER_ENABLED: bool(true),
  })
  .superRefine((env, ctx) => {
    const isProd = env.NODE_ENV === "production";
    if (env.STORAGE_DRIVER === "s3") {
      for (const key of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when STORAGE_DRIVER=s3` });
      }
    }
    // An internal storage name (http://minio:9000) can't be opened by browsers following a download link.
    const storageHost = env.S3_ENDPOINT && URL.canParse(env.S3_ENDPOINT) ? new URL(env.S3_ENDPOINT).hostname : "";
    if (isProd && env.STORAGE_DRIVER === "s3" && storageHost && !storageHost.includes(".") && !env.S3_PUBLIC_ENDPOINT) {
      ctx.addIssue({ code: "custom", path: ["S3_PUBLIC_ENDPOINT"], message: `S3_ENDPOINT (${storageHost}) is internal; set S3_PUBLIC_ENDPOINT to the address browsers use for downloads` });
    }
    if (isProd && env.STORAGE_DRIVER === "local") {
      ctx.addIssue({ code: "custom", path: ["STORAGE_DRIVER"], message: "STORAGE_DRIVER=local is for development only; use s3 in production" });
    }
    if (env.MAIL_DRIVER === "smtp" && !env.SMTP_HOST) {
      ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "SMTP_HOST is required when MAIL_DRIVER=smtp" });
    }
    if (isProd && env.MAIL_DRIVER === "file") {
      ctx.addIssue({ code: "custom", path: ["MAIL_DRIVER"], message: "MAIL_DRIVER=file is for development only" });
    }
    if (isProd) {
      for (const key of ["COMPANY_BANK_NAME", "COMPANY_BANK_ACCOUNT_NAME", "COMPANY_BANK_ACCOUNT_NUMBER", "COMPANY_BANK_IFSC"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required in production (printed on invoices)` });
      }
    }
    if (Boolean(env.AUTH_GOOGLE_ID) !== Boolean(env.AUTH_GOOGLE_SECRET)) {
      ctx.addIssue({ code: "custom", path: ["AUTH_GOOGLE_ID"], message: "Set both AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or neither" });
    }
  });

type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}

/** Base URL the server uses to reach itself (Chromium PDF rendering). */
export function internalAppUrl(): string {
  const e = env();
  return e.INTERNAL_APP_URL ?? `http://127.0.0.1:${e.PORT}`;
}

export function companyStateCode(): string {
  return env().COMPANY_GSTIN.slice(0, 2);
}

export function googleAuthEnabled(): boolean {
  const e = env();
  return Boolean(e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET);
}
