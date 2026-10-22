import type { NextRequest } from "next/server";
import { verifyPayload } from "@/server/crypto";
import { env } from "@/server/env";
import { contentDisposition, storage } from "@/server/storage";

/**
 * Development-only stand-in for presigned S3 URLs (STORAGE_DRIVER=local, refused in production).
 * Serves a stored object only for a valid, unexpired HMAC token minted by /api/files/[id].
 */
export async function GET(req: NextRequest) {
  if (env().STORAGE_DRIVER !== "local") return new Response("Not found", { status: 404 });
  const payload = verifyPayload<{ key: string; filename: string }>("local-storage", req.nextUrl.searchParams.get("token"));
  if (!payload) return new Response("Link expired", { status: 403 });
  try {
    const body = await storage().get(payload.key);
    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": contentDisposition(payload.filename),
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
