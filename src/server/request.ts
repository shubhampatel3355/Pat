import "server-only";
import { headers } from "next/headers";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export function metaFromHeaders(h: Headers): RequestMeta {
  // Coolify's Traefik sets X-Forwarded-For; the first entry is the client.
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip") || null;
  const userAgent = h.get("user-agent")?.slice(0, 400) ?? null;
  return { ip, userAgent };
}

export async function requestMeta(): Promise<RequestMeta> {
  return metaFromHeaders(await headers());
}

/**
 * Defence in depth on top of Next.js' own Server Action origin check (which lets requests without an
 * Origin header through): mutating requests must come from our own origin.
 */
export function isSameOrigin(h: Headers): boolean {
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const site = h.get("sec-fetch-site");
  return site === "same-origin" || site === "none";
}
