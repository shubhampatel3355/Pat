import { CredentialsSignin } from "next-auth";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeWithPassword } from "@/server/auth/config";
import { issueMobileToken } from "@/server/auth/mobile-token";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { json, readJson } from "@/server/mobile/http";

/** Same messages as the web's sign-in form (src/server/actions/auth.ts). */
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid work email"),
  password: z.string().min(1, "Enter your password").max(200),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code").optional(),
});

/** "pa••••@patmichaels.in" — enough to recognise the inbox. */
const maskEmail = (email: string) => email.replace(/^([^@]{1,2})[^@]*@/, (_, head: string) => `${head}••••@`);

/**
 * Mobile sign-in. Runs the web's own credential check (rate limits, deactivated accounts, the emailed
 * sign-in code for owners and admins, audit entries), then returns a bearer token for the app.
 */
export async function POST(req: NextRequest) {
  const parsed = loginSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ ok: false, error: parsed.error.issues[0]?.message ?? "Check your details" }, 400);
  const { email, password, otp } = parsed.data;
  try {
    const signedIn = await authorizeWithPassword({ email, password, remember: "1", ...(otp ? { otp } : {}) }, req);
    const user = await db.user.findUniqueOrThrow({ where: { id: signedIn.id }, select: { mustChangePassword: true } });
    const session = issueMobileToken({ id: signedIn.id, sessionVersion: signedIn.sessionVersion });
    return json({ ok: true, ...session, mustChangePassword: user.mustChangePassword });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      if (error.code === "rate_limited") return json({ ok: false, error: "Too many attempts. Wait 15 minutes and try again." }, 429);
      if (error.code === "otp_required") return json({ ok: false, otpRequired: true, otpSentTo: maskEmail(email), error: "Enter the sign-in code we emailed you." });
      if (error.code === "otp_invalid") return json({ ok: false, error: "That code is wrong or has expired. Check it, or send a new one." }, 401);
      return json({ ok: false, error: "That email and password don't match." }, 401);
    }
    logger.error({ err: error instanceof Error ? error.message : error }, "mobile sign-in failed");
    return json({ ok: false, error: "Couldn't sign you in. Please try again." }, 500);
  }
}
