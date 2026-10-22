import type { FolderKey } from "@/generated/prisma/enums";

export interface UploadedFile {
  id: string;
  name: string;
  ext: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  ownerName: string | null;
  canDelete: boolean;
}

/** POST files to /api/files (validated, scanned and stored server-side). */
export async function uploadFiles(files: File[], target: { folder?: FolderKey; ownerUserId?: string; invoiceId?: string }): Promise<{ files: UploadedFile[]; errors: string[] }> {
  if (!files.length) return { files: [], errors: [] };
  const body = new FormData();
  for (const f of files) body.append("files", f);
  if (target.folder) body.append("folder", target.folder);
  if (target.ownerUserId) body.append("ownerUserId", target.ownerUserId);
  if (target.invoiceId) body.append("invoiceId", target.invoiceId);
  try {
    const res = await fetch("/api/files", { method: "POST", body });
    const json = (await res.json()) as { files?: UploadedFile[]; errors?: string[]; error?: string };
    if (json.error) return { files: [], errors: [json.error] };
    return { files: json.files ?? [], errors: json.errors ?? [] };
  } catch {
    return { files: [], errors: ["Upload failed — check your connection and try again."] };
  }
}

export function formatBytes(bytes: number): string {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

export function fileExt(name: string): string {
  return (name.split(".").pop() ?? "FILE").slice(0, 4).toUpperCase();
}
