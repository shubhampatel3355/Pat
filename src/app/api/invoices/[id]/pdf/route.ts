import { writeAudit } from "@/server/audit";
import { getApiUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { invoicePdf } from "@/server/pdf/documents";
import { has } from "@/server/policy";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { metaFromHeaders } from "@/server/request";

/** Branded PDF of an invoice, proforma or credit note (rendered once by Chromium, then served from storage). */
export async function GET(req: Request, ctx: RouteContext<"/api/invoices/[id]/pdf">) {
  const user = await getApiUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!has(user, "invoices.view")) return Response.json({ error: "Not found" }, { status: 404 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const limit = await rateLimit(`pdf:${user.id}`, LIMITS.pdfPerUser.limit, LIMITS.pdfPerUser.windowSec);
  if (!limit.ok) return Response.json({ error: "Too many PDFs at once. Try again in a few minutes." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } });
  const exists = await db.invoice.findUnique({ where: { id }, select: { id: true, number: true } });
  if (!exists) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const { filename, bytes } = await invoicePdf(id);
    await writeAudit(db, { actor: user, module: "Invoices", action: "download", text: `${user.name} downloaded ${exists.number} as PDF`, entityType: "Invoice", entityId: id, meta: metaFromHeaders(req.headers) });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (err) {
    logger.error({ err: (err as Error).message, id }, "invoice pdf failed");
    return Response.json({ error: "The PDF could not be generated. Try again shortly." }, { status: 503 });
  }
}
