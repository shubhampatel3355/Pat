import "server-only";

/**
 * Decide a file's real type from its first bytes (never trust the browser's Content-Type).
 * Allow-list: PDF, images, Office documents, ZIP, CSV/TXT. Anything else is rejected
 * (executables, HTML, SVG and other active content).
 */
interface SniffResult {
  mime: string;
  ext: string;
}

const OOXML: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};
const OLE: Record<string, string> = { doc: "application/msword", xls: "application/vnd.ms-excel", ppt: "application/vnd.ms-powerpoint" };

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

function extensionOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return m ? m[1]! : "";
}

function looksLikeText(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 64 * 1024));
  if (sample.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample.length === buf.length ? sample : sample.subarray(0, sample.length - 4));
    return true;
  } catch {
    return false;
  }
}

export function sniffFile(name: string, buf: Buffer): SniffResult | null {
  const ext = extensionOf(name);
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", ext: "pdf" }; // %PDF-
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: ext === "jpeg" ? "jpeg" : "jpg" };
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return { mime: "image/webp", ext: "webp" };
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) return OOXML[ext] ? { mime: OOXML[ext]!, ext } : null;
  if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return OLE[ext] ? { mime: OLE[ext]!, ext } : null;
  if ((ext === "csv" || ext === "txt") && looksLikeText(buf)) return { mime: ext === "csv" ? "text/csv" : "text/plain", ext };
  return null;
}

export const ALLOWED_DESCRIPTION = "PDF, JPG, PNG, WEBP, Word, Excel, PowerPoint, ZIP, CSV or TXT";
