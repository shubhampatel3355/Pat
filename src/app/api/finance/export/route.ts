import { financialYear, formatDateTime, fyOfIso, isoDateIST } from "@/lib/dates";
import { financeExportQuerySchema } from "@/lib/schemas/finance";
import { writeAudit } from "@/server/audit";
import { getApiUser } from "@/server/auth/session";
import { companyProfile } from "@/server/company";
import { db } from "@/server/db";
import { financeWorkbook } from "@/server/exports/finance-xlsx";
import { logger } from "@/server/logger";
import { renderPdf } from "@/server/pdf/render";
import { can } from "@/server/policy";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { metaFromHeaders } from "@/server/request";
import { financeReport } from "@/server/services/finance";

const TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

/** Finance report for one FY as XLSX (exceljs) or PDF (Chromium printing /print/finance/[fy]). */
export async function GET(req: Request) {
  const user = await getApiUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!can(user, "export", { type: "finance" })) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = financeExportQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Pick a financial year and a format." }, { status: 400 });
  const today = isoDateIST();
  if (parsed.data.fy > fyOfIso(today).startYear) return Response.json({ error: "That financial year hasn't started yet." }, { status: 400 });
  const limit = await rateLimit(`export:${user.id}`, LIMITS.exportPerUser.limit, LIMITS.exportPerUser.windowSec);
  if (!limit.ok) return Response.json({ error: "Too many exports at once. Try again in a few minutes." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } });

  const fy = financialYear(parsed.data.fy);
  const { format } = parsed.data;
  try {
    const bytes =
      format === "xlsx"
        ? await financeWorkbook(await financeReport(fy, today), companyProfile(), { by: user.name, at: formatDateTime(new Date()) })
        : await renderPdf({ kind: "finance", fy: String(fy.startYear) });
    await writeAudit(db, {
      actor: user,
      module: "Finance",
      action: "export",
      text: `${user.name} exported the ${fy.label} finance report as ${format.toUpperCase()}`,
      entityType: "FinanceReport",
      entityId: fy.key,
      meta: metaFromHeaders(req.headers),
      visibility: "PRIVATE",
    });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": TYPES[format],
        "content-disposition": `attachment; filename="Pat-Michaels-Finance-${fy.key}.${format}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (err) {
    logger.error({ err: (err as Error).message, fy: fy.key, format }, "finance export failed");
    return Response.json({ error: "The report could not be generated. Try again shortly." }, { status: 503 });
  }
}
