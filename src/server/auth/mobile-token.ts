import "server-only";
import { signPayload, verifyPayload } from "../crypto";
import { env } from "../env";

/**
 * Sign-in for the mobile app: a signed, expiring token sent as "Authorization: Bearer <token>".
 * Like the web's session cookie it carries the user's session version, so changing the password or
 * deactivating the account signs the app out too. Lifetime: AUTH_REMEMBER_DAYS, renewed while in use.
 */
const PURPOSE = "mobile-session";

export interface MobileClaims {
  uid: string;
  sv: number;
  /** Issued at (Unix seconds). */
  iat: number;
}

export function issueMobileToken(user: { id: string; sessionVersion: number }): { token: string; expiresAt: string } {
  const ttlSeconds = env().AUTH_REMEMBER_DAYS * 86_400;
  const iat = Math.floor(Date.now() / 1000);
  return {
    token: signPayload(PURPOSE, { uid: user.id, sv: user.sessionVersion, iat }, ttlSeconds),
    expiresAt: new Date((iat + ttlSeconds) * 1000).toISOString(),
  };
}

export function verifyMobileToken(token: string): MobileClaims | null {
  const claims = verifyPayload<{ uid?: unknown; sv?: unknown; iat?: unknown }>(PURPOSE, token);
  if (!claims || typeof claims.uid !== "string" || typeof claims.sv !== "number" || typeof claims.iat !== "number") return null;
  return { uid: claims.uid, sv: claims.sv, iat: claims.iat };
}

/** Renew tokens older than a day, so people who use the app stay signed in. */
export function shouldRenew(claims: MobileClaims): boolean {
  return Date.now() / 1000 - claims.iat > 86_400;
}
