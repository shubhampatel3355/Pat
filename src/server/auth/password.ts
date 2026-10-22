import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { ARGON2_OPTIONS as OPTIONS } from "./argon-options";

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

let dummyHash: Promise<string> | undefined;

/**
 * Constant-work verification: when the account does not exist (or has no password yet) we still
 * run argon2 against a dummy hash so response times do not reveal which emails exist.
 */
export async function verifyPassword(storedHash: string | null | undefined, plain: string): Promise<boolean> {
  if (!storedHash) {
    dummyHash ??= hash("pat-michaels-os-dummy-password", OPTIONS);
    await verify(await dummyHash, plain).catch(() => false);
    return false;
  }
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}

/** Returns a reason the password is unacceptable, or null. */
export function passwordProblem(plain: string, email?: string): string | null {
  if (plain.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters`;
  if (plain.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters`;
  if (/^(.)\1+$/.test(plain)) return "Avoid repeating one character";
  const lower = plain.toLowerCase();
  if (email && lower.includes(email.split("@")[0].toLowerCase())) return "Don't include your email name";
  if (["password", "patmichaels", "123456789", "qwertyuiop"].some((w) => lower.includes(w))) return "That password is too easy to guess";
  return null;
}
