import "server-only";

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

/**
 * The mobile app's credentials ("Authorization: Bearer <token>"), or null when the request has none.
 * Other schemes (e.g. Basic from a proxy) are not ours and are ignored.
 */
export function bearerToken(h: Headers): string | null {
  const value = h.get("authorization");
  const match = value ? /^Bearer\s+(.*)$/i.exec(value) : null;
  return match ? match[1]!.trim() : null;
}

/**
 * Defence in depth on top of Next.js' own Server Action origin check (which lets requests without an
 * Origin header through): mutating requests must come from our own origin.
 */
export function isSameOrigin(h: Headers): boolean {
  // Mobile app: browsers never attach an Authorization header on their own, so a bearer request can't be a
  // cross-site forgery — and getSessionUser() authenticates it by that token alone, never by cookies.
  if (bearerToken(h) !== null) return true;
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
