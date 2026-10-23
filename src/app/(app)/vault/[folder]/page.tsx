import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FolderScreen } from "@/components/vault/folder-screen";
import { requireUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { has } from "@/server/policy";
import { FOLDER_BY_SLUG, vaultFiles, vaultFolders } from "@/server/services/vault";
import { activeUserOptions } from "@/server/services/wip";

export const metadata: Metadata = { title: "Contracts & Vault" };

export default async function VaultFolderPage({ params }: { params: Promise<{ folder: string }> }) {
  const user = await requireUser();
  const key = FOLDER_BY_SLUG[(await params).folder];
  if (!key) notFound();
  const folders = await vaultFolders(user);
  const folder = folders.find((f) => f.key === key);
  if (!folder) notFound();
  const [files, employees] = await Promise.all([vaultFiles(user, key), has(user, "vault.employee_all") ? activeUserOptions() : Promise.resolve(null)]);
  const e = env();
  return <FolderScreen folder={folder} folders={folders} files={files} employees={employees} me={user.id} limits={{ maxMb: e.UPLOAD_MAX_MB, scanned: Boolean(e.CLAMAV_HOST) }} />;
}
