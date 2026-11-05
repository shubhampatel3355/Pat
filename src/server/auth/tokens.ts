import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { AuthTokenType } from "@/generated/prisma/enums";
import { randomCode, randomToken, sha256Hex } from "../crypto";
import { loginCodeEmail } from "../email/templates";
import { enqueue, QUEUES } from "../queue";
import type { Tx } from "../db";
import { db } from "../db";

export const INVITE_TTL_HOURS = 72;
export const RESET_TTL_MINUTES = 60;

/** Creates a single-use token and returns the raw value (only its hash is stored). */
export async function issueAuthToken(tx: Tx, userId: string, type: AuthTokenType, ttlMs: number): Promise<string> {
  // A new link supersedes older unused links of the same kind.
  await tx.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  const raw = randomToken(32);
  await tx.authToken.create({ data: { userId, type, tokenHash: sha256Hex(raw), expiresAt: new Date(Date.now() + ttlMs) } });
  return raw;
}

/** Looks up a still-valid token (not used, not expired) without consuming it. */
export async function findValidToken(raw: string, types: AuthTokenType[]) {
  if (!raw || raw.length > 200) return null;
  const token = await db.authToken.findUnique({ where: { tokenHash: sha256Hex(raw) }, include: { user: true } });
  if (!token || token.usedAt || token.expiresAt < new Date() || !types.includes(token.type)) return null;
  if (!token.user.active || token.user.deletedAt) return null;
  return token;
}

// ── Sign-in codes (owners and admins when AUTH_OTP_FOR_ADMINS is on) ──────────

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

/** Emails a fresh six-digit code; older unused codes stop working. Only a hash keyed to the token id is stored. */
export async function issueLoginOtp(user: { id: string; name: string; email: string }): Promise<void> {
  const code = randomCode();
  const id = randomUUID();
  const mail = loginCodeEmail({ name: user.name, code, minutes: OTP_TTL_MINUTES });
  await db.$transaction(async (tx) => {
    await tx.authToken.updateMany({ where: { userId: user.id, type: "LOGIN_OTP", usedAt: null }, data: { usedAt: new Date() } });
    await tx.authToken.create({ data: { id, userId: user.id, type: "LOGIN_OTP", tokenHash: sha256Hex(`${id}:${code}`), expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000) } });
    await enqueue(QUEUES.email, { to: user.email, subject: mail.subject, html: mail.html, text: mail.text }, { tx });
  });
}

/** Checks a code against the latest live one; it is consumed on success and burnt after too many misses. */
export async function verifyLoginOtp(userId: string, code: string): Promise<boolean> {
  const token = await db.authToken.findFirst({ where: { userId, type: "LOGIN_OTP", usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!token) return false;
  const expected = Buffer.from(token.tokenHash);
  const actual = Buffer.from(sha256Hex(`${token.id}:${code}`));
  if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
    const used = await db.authToken.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: new Date() } });
    return used.count === 1;
  }
  const attempts = token.attempts + 1;
  await db.authToken.update({ where: { id: token.id }, data: { attempts, ...(attempts >= OTP_MAX_ATTEMPTS ? { usedAt: new Date() } : {}) } });
  return false;
}
