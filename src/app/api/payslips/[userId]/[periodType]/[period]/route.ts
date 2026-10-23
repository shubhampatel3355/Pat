import type { StatementType } from "@/lib/payroll";
import { writeAudit } from "@/server/audit";
import { getApiUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { payslipPdf } from "@/server/pdf/documents";
import { can } from "@/server/policy";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { metaFromHeaders } from "@/server/request";

const TYPES: StatementType[] = ["MONTHLY", "QUARTERLY", "YEARLY"];

/** Payslip / pay statement PDF: the employee's own, or anyone's for payroll managers. */
export async function GET(req: Request, ctx: RouteContext<"/api/payslips/[userId]/[periodType]/[period]">) {
  const user = await getApiUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const { userId, periodType, period } = await ctx.params;
  const key = decodeURIComponent(period);
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !TYPES.includes(periodType as StatementType)) return Response.json({ error: "Not found" }, { status: 404 });
  if (!can(user, "view", { type: "payroll", userId })) return Response.json({ error: "Not found" }, { status: 404 });
  const limit = await rateLimit(`pdf:${user.id}`, LIMITS.pdfPerUser.limit, LIMITS.pdfPerUser.windowSec);
  if (!limit.ok) return Response.json({ error: "Too many PDFs at once. Try again in a few minutes." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } });
  try {
    const pdf = await payslipPdf(userId, periodType as StatementType, key);
    if (!pdf) return Response.json({ error: "No payslip has been paid for that period." }, { status: 404 });
    await writeAudit(db, {
      actor: user,
      module: "Payroll",
      action: "download",
      text: `${user.name} downloaded ${pdf.filename}`,
      entityType: "Payslip",
      entityId: `${userId}:${periodType}:${key}`,
      meta: metaFromHeaders(req.headers),
      visibility: "RESTRICTED",
      subjectUserIds: [userId],
    });
    return new Response(new Uint8Array(pdf.bytes), {
      headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${pdf.filename}"`, "cache-control": "private, no-store" },
    });
  } catch (err) {
    logger.error({ err: (err as Error).message, userId, periodType, period: key }, "payslip pdf failed");
    return Response.json({ error: "The payslip could not be generated. Try again shortly." }, { status: 503 });
  }
}
