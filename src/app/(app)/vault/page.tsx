import type { Metadata } from "next";
import { VaultScreen } from "@/components/vault/vault-screen";
import { requireUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { has } from "@/server/policy";
import { storageEncrypted } from "@/server/storage";
import { vaultFolders } from "@/server/services/vault";
import { activeUserOptions } from "@/server/services/wip";

export const metadata: Metadata = { title: "Contracts & Vault" };

export default async function VaultPage() {
  const user = await requireUser();
  const [folders, employees] = await Promise.all([vaultFolders(user), has(user, "vault.employee_all") ? activeUserOptions() : Promise.resolve(null)]);
  const e = env();
  return <VaultScreen folders={folders} employees={employees} me={user.id} encrypted={storageEncrypted()} limits={{ maxMb: e.UPLOAD_MAX_MB, scanned: Boolean(e.CLAMAV_HOST) }} />;
}
