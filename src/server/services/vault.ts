import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { FolderKey } from "@/generated/prisma/enums";
import { isoDateIST } from "@/lib/dates";
import { db } from "../db";
import { can, has, type SessionUser } from "../policy";
import { toFileDto, type FileDto } from "./files";

/** URL slugs for /vault/[folder]. */
export const FOLDER_BY_SLUG: Record<string, FolderKey> = { pm: "PM_DOCUMENTS", client: "CLIENT_DOCUMENTS", employee: "EMPLOYEE_DOCUMENTS" };
export const SLUG_BY_FOLDER: Record<FolderKey, string> = { PM_DOCUMENTS: "pm", CLIENT_DOCUMENTS: "client", EMPLOYEE_DOCUMENTS: "employee" };
const ORDER: FolderKey[] = ["PM_DOCUMENTS", "CLIENT_DOCUMENTS", "EMPLOYEE_DOCUMENTS"];

export interface FolderCardDto {
  key: FolderKey;
  slug: string;
  name: string;
  count: number;
  sizeBytes: number;
  /** Latest upload in what the viewer can see (ISO date), or null when empty. */
  updated: string | null;
}

const canOpenFolder = (user: SessionUser, key: FolderKey) => can(user, "view", { type: "vault", folder: key });

/** Files of a folder the viewer may see: Employee Documents are limited to their own unless vault.employee_all. */
function fileScope(user: SessionUser, key: FolderKey): Prisma.FileWhereInput {
  const base: Prisma.FileWhereInput = { deletedAt: null, folder: { key } };
  return key === "EMPLOYEE_DOCUMENTS" && !has(user, "vault.employee_all") ? { ...base, ownerUserId: user.id } : base;
}

/** Every file the viewer may open, across folders (for ⌘K search). */
export function searchableFiles(user: SessionUser): Prisma.FileWhereInput {
  return { OR: ORDER.filter((key) => canOpenFolder(user, key)).map((key) => fileScope(user, key)) };
}

export async function vaultFolders(user: SessionUser): Promise<FolderCardDto[]> {
  const folders = await db.folder.findMany();
  const visible = ORDER.flatMap((key) => {
    const f = folders.find((x) => x.key === key);
    return f && canOpenFolder(user, key) ? [f] : [];
  });
  const totals = await db.file.groupBy({ by: ["folderId"], where: searchableFiles(user), _count: { _all: true }, _sum: { sizeBytes: true }, _max: { createdAt: true } });
  return visible.map((f) => {
    const t = totals.find((x) => x.folderId === f.id);
    return { key: f.key, slug: SLUG_BY_FOLDER[f.key], name: f.name, count: t?._count._all ?? 0, sizeBytes: t?._sum.sizeBytes ?? 0, updated: t?._max.createdAt ? isoDateIST(t._max.createdAt) : null };
  });
}

export async function vaultFiles(user: SessionUser, key: FolderKey): Promise<FileDto[]> {
  const rows = await db.file.findMany({
    where: fileScope(user, key),
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: { uploadedBy: { select: { name: true } }, owner: { select: { name: true } }, folder: { select: { key: true } } },
  });
  return rows.map((f) => toFileDto(user, f));
}
