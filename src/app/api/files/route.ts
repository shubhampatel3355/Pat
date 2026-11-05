import { z } from "zod";
import { getApiUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { can, has } from "@/server/policy";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { isSameOrigin, metaFromHeaders } from "@/server/request";
import { saveUpload, UploadError, type FileDto } from "@/server/services/files";

const fieldsSchema = z.object({
  folder: z.enum(["PM_DOCUMENTS", "CLIENT_DOCUMENTS", "EMPLOYEE_DOCUMENTS"]).nullable(),
  ownerUserId: z.uuid().nullable(),
  invoiceId: z.uuid().nullable(),
});

const MAX_FILES = 10;

/** Multipart upload: `files` (1–10), plus `folder`, optional `ownerUserId` (Employee Documents) or `invoiceId`. */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return Response.json({ error: "Request blocked (cross-site)." }, { status: 403 });
  const user = await getApiUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });

  const limit = await rateLimit(`upload:${user.id}`, LIMITS.uploadPerUser.limit, LIMITS.uploadPerUser.windowSec);
  if (!limit.ok) return Response.json({ error: "Too many uploads. Wait a few minutes." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } });

  // Refuse an oversized request before reading it into memory; saveUpload still checks each file.
  const { UPLOAD_MAX_MB } = env();
  if (Number(req.headers.get("content-length") ?? 0) > (MAX_FILES * UPLOAD_MAX_MB + 1) * 1024 * 1024) {
    return Response.json({ error: `Upload at most ${MAX_FILES} files of ${UPLOAD_MAX_MB} MB each.` }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Upload could not be read." }, { status: 400 });
  }
  const parsed = fieldsSchema.safeParse({
    folder: form.get("folder") || null,
    ownerUserId: form.get("ownerUserId") || null,
    invoiceId: form.get("invoiceId") || null,
  });
  if (!parsed.success) return Response.json({ error: "Invalid upload target." }, { status: 400 });
  let { folder, ownerUserId } = parsed.data;
  const { invoiceId } = parsed.data;

  // Authorisation
  if (invoiceId) {
    if (!has(user, "invoices.create")) return Response.json({ error: "You don't have access to do that." }, { status: 403 });
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, select: { id: true } });
    if (!invoice) return Response.json({ error: "Invoice not found." }, { status: 404 });
    folder = "CLIENT_DOCUMENTS";
    ownerUserId = null;
  } else {
    if (!folder) return Response.json({ error: "Choose a folder." }, { status: 400 });
    if (folder === "EMPLOYEE_DOCUMENTS") {
      // Employees can only file documents about themselves.
      if (!has(user, "vault.employee_all")) ownerUserId = user.id;
      if (!ownerUserId) ownerUserId = user.id;
      const owner = await db.user.findFirst({ where: { id: ownerUserId, deletedAt: null }, select: { id: true } });
      if (!owner) return Response.json({ error: "Unknown employee." }, { status: 400 });
    } else {
      ownerUserId = null;
    }
    if (!can(user, "create", { type: "vault", folder, ownerUserId })) return Response.json({ error: "You don't have access to that folder." }, { status: 403 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "Choose at least one file." }, { status: 400 });
  if (files.length > MAX_FILES) return Response.json({ error: `Upload at most ${MAX_FILES} files at a time.` }, { status: 400 });

  const meta = metaFromHeaders(req.headers);
  const saved: FileDto[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      saved.push(await saveUpload({ user, meta, file, folderKey: folder, ownerUserId, invoiceId }));
    } catch (err) {
      errors.push(err instanceof UploadError ? err.message : `${file.name} could not be uploaded`);
    }
  }
  return Response.json({ files: saved, errors }, { status: saved.length ? 200 : 400 });
}
