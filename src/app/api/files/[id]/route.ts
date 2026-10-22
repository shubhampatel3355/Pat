import { writeAudit } from "@/server/audit";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { isSameOrigin, metaFromHeaders } from "@/server/request";
import { canDeleteFile, canViewFile } from "@/server/services/files";
import { storage } from "@/server/storage";

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return db.file.findFirst({ where: { id, deletedAt: null }, include: { folder: { select: { key: true, name: true } } } });
}

/** Download: permission check, audit, then a 60-second presigned redirect. Never streams from the app disk in production. */
export async function GET(req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const { id } = await ctx.params;
  const file = await load(id);
  if (!file || !canViewFile(user, file)) return Response.json({ error: "File not found." }, { status: 404 });

  await writeAudit(db, {
    actor: user,
    module: file.invoiceId ? "Invoices" : "Vault",
    action: "download",
    text: `${user.name} downloaded ${file.name}`,
    entityType: "File",
    entityId: file.id,
    meta: metaFromHeaders(req.headers),
  });
  const url = await storage().signedDownloadUrl(file.storageKey, file.name, 60);
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "no-store" } });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/files/[id]">) {
  if (!isSameOrigin(req.headers)) return Response.json({ error: "Request blocked (cross-site)." }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const { id } = await ctx.params;
  const file = await load(id);
  if (!file || !canViewFile(user, file)) return Response.json({ error: "File not found." }, { status: 404 });
  if (!canDeleteFile(user, file)) return Response.json({ error: "You can't delete this file." }, { status: 403 });

  await db.$transaction(async (tx) => {
    await tx.file.update({ where: { id: file.id }, data: { deletedAt: new Date() } });
    await writeAudit(tx, {
      actor: user,
      module: file.invoiceId ? "Invoices" : "Vault",
      action: "delete",
      text: `${user.name} deleted ${file.name}${file.folder ? ` from ${file.folder.name}` : ""}`,
      entityType: "File",
      entityId: file.id,
      before: { name: file.name, folder: file.folder?.key, ownerUserId: file.ownerUserId },
      meta: metaFromHeaders(req.headers),
    });
  });
  // With bucket versioning on, this leaves a recoverable delete marker.
  await storage().remove(file.storageKey);
  return Response.json({ ok: true });
}
