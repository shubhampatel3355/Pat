import "server-only";
import type { AuthTokenType } from "@/generated/prisma/enums";
import { randomToken, sha256Hex } from "../crypto";
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
