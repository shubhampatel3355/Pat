import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { ApiError, api, getToken } from "./client";
import { apiUrl } from "./config";
import type { FileLink, UploadResponse } from "./types";

/**
 * Files: PDFs and exports come from the web's own endpoints (invoice and payslip PDFs, finance export) with the
 * session token; vault documents open through 60-second signed links, exactly as on the web.
 */

const safeName = (name: string) => name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file";

const UTI: Record<string, string> = {
  "application/pdf": "com.adobe.pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "org.openxmlformats.spreadsheetml.sheet",
};

async function share(uri: string, mimeType: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) throw new ApiError("Sharing isn't available on this device.", 0);
  await Sharing.shareAsync(uri, { mimeType, UTI: UTI[mimeType], dialogTitle: title });
}

async function errorFrom(uri: string, status: number): Promise<ApiError> {
  try {
    const body = JSON.parse(await FileSystem.readAsStringAsync(uri)) as { error?: string };
    return new ApiError(body.error ?? `Download failed (${status})`, status);
  } catch {
    return new ApiError(`Download failed (${status})`, status);
  }
}

/** Downloads a backend file with the session token (e.g. /api/invoices/<id>/pdf), then opens the share sheet. */
export async function downloadAndShare(path: string, filename: string, mimeType: string): Promise<void> {
  const target = `${FileSystem.cacheDirectory}${Date.now()}-${safeName(filename)}`;
  const token = getToken();
  const res = await FileSystem.downloadAsync(apiUrl() + path, target, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (res.status !== 200) throw await errorFrom(res.uri, res.status);
  await share(res.uri, mimeType, filename);
}

/** Vault / invoice attachment: fetch a signed link (audited on the server), download it, share it. */
export async function openStoredFile(fileId: string): Promise<void> {
  const link = await api.get<FileLink>(`/api/mobile/v1/files/${fileId}/link`);
  const url = /^https?:\/\//i.test(link.url) ? link.url : apiUrl() + link.url;
  const target = `${FileSystem.cacheDirectory}${Date.now()}-${safeName(link.name)}`;
  // A signed link carries its own authorisation: no token is sent to the storage server.
  const res = await FileSystem.downloadAsync(url, target);
  if (res.status !== 200) throw await errorFrom(res.uri, res.status);
  await share(res.uri, link.mime || "application/octet-stream", link.name);
}

export async function deleteStoredFile(fileId: string): Promise<void> {
  await api.delete(`/api/files/${fileId}`);
}

export async function pickDocuments(): Promise<DocumentPicker.DocumentPickerAsset[]> {
  const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: ["application/pdf", "image/*", "application/vnd.openxmlformats-officedocument.*", "application/msword", "application/vnd.ms-excel", "text/csv"] });
  return result.canceled ? [] : result.assets;
}

/**
 * Uploads to the web's /api/files (same checks: size, file type, virus scan, folder permissions, audit).
 * React Native's XMLHttpRequest sends picked files as multipart parts from their local uri.
 */
export function uploadDocuments(target: { folder?: string; ownerUserId?: string | null; invoiceId?: string }, assets: DocumentPicker.DocumentPickerAsset[]): Promise<UploadResponse> {
  const form = new FormData();
  if (target.folder) form.append("folder", target.folder);
  if (target.ownerUserId) form.append("ownerUserId", target.ownerUserId);
  if (target.invoiceId) form.append("invoiceId", target.invoiceId);
  for (const a of assets) {
    // React Native's FormData accepts { uri, name, type } for files.
    form.append("files", { uri: a.uri, name: a.name, type: a.mimeType ?? "application/octet-stream" } as unknown as Blob);
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiUrl()}/api/files`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.onload = () => {
      let body: (UploadResponse & { error?: string }) | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (body && Array.isArray(body.files)) resolve(body);
      else reject(new ApiError(body?.error ?? `Upload failed (${xhr.status})`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Upload failed. Check your connection and try again.", 0, "network"));
    xhr.send(form);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
