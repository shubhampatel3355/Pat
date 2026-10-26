import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { FolderKey } from "@/generated/prisma/enums";
import { writeAudit } from "../audit";
import { db } from "../db";
import { env } from "../env";
import { logger } from "../logger";
import { can, has, type SessionUser } from "../policy";
import type { RequestMeta } from "../request";
import { scanBuffer } from "../storage/clamav";
import { storage } from "../storage";
import { ALLOWED_DESCRIPTION, sniffFile } from "../storage/sniff";

export interface FileDto {
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

export class UploadError extends Error {}

interface FileAccessRow {
  folder: { key: FolderKey } | null;
  ownerUserId: string | null;
  uploadedById: string;
  invoiceId: string | null;
}

export function canViewFile(user: SessionUser, f: FileAccessRow): boolean {
  if (f.invoiceId && has(user, "invoices.view")) return true;
  if (f.folder) return can(user, "view", { type: "vault", folder: f.folder.key, ownerUserId: f.ownerUserId });
  return user.role === "OWNER" || user.role === "ADMIN";
}

export function canDeleteFile(user: SessionUser, f: FileAccessRow): boolean {
  if (f.folder) return can(user, "delete", { type: "vault", folder: f.folder.key, ownerUserId: f.ownerUserId, uploadedById: f.uploadedById });
  return f.invoiceId ? has(user, "invoices.create") : user.role === "OWNER";
}

interface SaveInput {
  user: SessionUser;
  meta: RequestMeta;
  file: File;
  folderKey: FolderKey | null;
  ownerUserId: string | null;
  invoiceId: string | null;
}

/** Validates, scans and stores one upload, then records it (and an audit entry). */
export async function saveUpload({ user, meta, file, folderKey, ownerUserId, invoiceId }: SaveInput): Promise<FileDto> {
  const maxBytes = env().UPLOAD_MAX_MB * 1024 * 1024;
  if (file.size === 0) throw new UploadError(`${file.name} is empty`);
  if (file.size > maxBytes) throw new UploadError(`${file.name} is larger than ${env().UPLOAD_MAX_MB} MB`);
  const name = file.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 180) || "file";
  const buf = Buffer.from(await file.arrayBuffer());

  const type = sniffFile(name, buf);
  if (!type) throw new UploadError(`${name}: only ${ALLOWED_DESCRIPTION} files are allowed`);

  let verdict;
  try {
    verdict = await scanBuffer(buf);
  } catch (err) {
    logger.error({ err: (err as Error).message }, "virus scan failed");
    throw new UploadError("The virus scanner is unavailable. Try again shortly.");
  }
  if (verdict.status === "INFECTED") {
    await writeAudit(db, { actor: user, module: "Vault", action: "create", text: `Blocked infected upload ${name} (${verdict.signature})`, meta });
    throw new UploadError(`${name} was blocked by the virus scanner`);
  }

  const folder = folderKey ? await db.folder.findUnique({ where: { key: folderKey } }) : null;
  if (folderKey && !folder) throw new UploadError("Unknown folder");

  const sha256 = createHash("sha256").update(buf).digest("hex");
  const storageKey = `${folderKey?.toLowerCase().replace(/_/g, "-") ?? "attachments"}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${type.ext}`;
  await storage().put(storageKey, buf, type.mime);

  const row = await db.$transaction(async (tx) => {
    const created = await tx.file.create({
      data: {
        folderId: folder?.id ?? null,
        name,
        storageKey,
        sizeBytes: buf.length,
        mime: type.mime,
        sha256,
        ownerUserId,
        invoiceId,
        uploadedById: user.id,
        scanStatus: verdict.status,
      },
      include: { uploadedBy: { select: { name: true } }, owner: { select: { name: true } }, folder: { select: { key: true } } },
    });
    await writeAudit(tx, {
      actor: user,
      module: invoiceId ? "Invoices" : "Vault",
      action: "create",
      text: `${user.name} uploaded ${name}${folder ? ` to ${folder.name}` : ""}`,
      entityType: "File",
      entityId: created.id,
      after: { name, sizeBytes: buf.length, mime: type.mime, folder: folderKey, ownerUserId, invoiceId },
      meta,
      visibility: ownerUserId ? "RESTRICTED" : "PRIVATE",
      subjectUserIds: ownerUserId ? [ownerUserId] : [],
    });
    return created;
  });

  return toFileDto(user, row);
}

export function toFileDto(
  user: SessionUser,
  f: { id: string; name: string; sizeBytes: number; mime: string; createdAt: Date; ownerUserId: string | null; uploadedById: string; invoiceId: string | null; uploadedBy: { name: string }; owner: { name: string } | null; folder: { key: FolderKey } | null },
): FileDto {
  return {
    id: f.id,
    name: f.name,
    ext: (f.name.split(".").pop() ?? "FILE").slice(0, 4).toUpperCase(),
    sizeBytes: f.sizeBytes,
    mime: f.mime,
    uploadedAt: f.createdAt.toISOString(),
    uploadedBy: f.uploadedBy.name,
    ownerName: f.owner?.name ?? null,
    canDelete: canDeleteFile(user, f),
  };
}
