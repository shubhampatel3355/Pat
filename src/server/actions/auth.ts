"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { writeAudit } from "../audit";
import { signIn, unstable_update } from "../auth/config";
import { hashPassword, passwordProblem, verifyPassword } from "../auth/password";
import { findValidToken, issueAuthToken, RESET_TTL_MINUTES } from "../auth/tokens";
import { db } from "../db";
import { passwordResetEmail } from "../email/templates";
import { env, googleAuthEnabled } from "../env";
import { logger } from "../logger";
import { inMobileApi } from "../mobile/context";
import { enqueue, QUEUES } from "../queue";
import { LIMITS, rateLimit } from "../rate-limit";
import { isSameOrigin, metaFromHeaders } from "../request";
import { defineAction, UserError } from "./define";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid work email"),
  password: z.string().min(1, "Enter your password").max(200),
  remember: z.boolean(),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code").optional(),
});

/** "pa••••@patmichaels.in" — enough to recognise the inbox. */
const maskEmail = (email: string) => email.replace(/^([^@]{1,2})[^@]*@/, (_, head: string) => `${head}••••@`);

export async function loginAction(input: z.input<typeof loginSchema>): Promise<ActionResult<{ otpSentTo: string }>> {
  const h = await headers();
  if (!isSameOrigin(h)) return fail("Request blocked (cross-site).");
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your details");
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      remember: parsed.data.remember ? "1" : "0",
      ...(parsed.data.otp ? { otp: parsed.data.otp } : {}),
      redirect: false,
    });
    return ok();
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error as AuthError & { code?: string }).code;
      if (code === "rate_limited") return fail("Too many attempts. Wait 15 minutes and try again.");
      if (code === "otp_required") return ok(undefined, { otpSentTo: maskEmail(parsed.data.email) });
      if (code === "otp_invalid") return fail("That code is wrong or has expired. Check it, or send a new one.");
      if (error.type === "CredentialsSignin") return fail("That email and password don't match.");
      logger.warn({ type: error.type }, "sign-in error");
      return fail("Couldn't sign you in. Please try again.");
    }
    unstable_rethrow(error);
    logger.error({ err: error instanceof Error ? error.message : error }, "sign-in failed");
    return fail("Couldn't sign you in. Please try again.");
  }
}

export async function googleLoginAction(): Promise<void> {
  if (!googleAuthEnabled()) return;
  await signIn("google", { redirectTo: "/dashboard" });
}

const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid work email") });

/** Always answers the same way, so it can't be used to discover which emails have accounts. */
export async function forgotPasswordAction(input: z.input<typeof forgotSchema>): Promise<ActionResult> {
  const h = await headers();
  if (!isSameOrigin(h)) return fail("Request blocked (cross-site).");
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter a valid email");
  const { email } = parsed.data;
  const meta = metaFromHeaders(h);
  const generic = ok("If that email has an account, a reset link is on its way.");

  const [byEmail, byIp] = await Promise.all([
    rateLimit(`reset:email:${email}`, LIMITS.passwordResetPerEmail.limit, LIMITS.passwordResetPerEmail.windowSec),
    rateLimit(`reset:ip:${meta.ip ?? "unknown"}`, 20, 3600),
  ]);
  if (!byEmail.ok || !byIp.ok) return generic;

  const user = await db.user.findFirst({ where: { email, deletedAt: null, active: true } });
  if (!user) return generic;

  await db.$transaction(async (tx) => {
    const raw = await issueAuthToken(tx, user.id, "PASSWORD_RESET", RESET_TTL_MINUTES * 60_000);
    const link = `${env().APP_URL.replace(/\/$/, "")}/set-password?token=${encodeURIComponent(raw)}`;
    const mail = passwordResetEmail({ name: user.name, link, expiresMinutes: RESET_TTL_MINUTES });
    await enqueue(QUEUES.email, { to: user.email, subject: mail.subject, html: mail.html, text: mail.text }, { tx });
    await writeAudit(tx, { actor: user, module: "Auth", action: "update", text: `${user.name} requested a password reset`, entityType: "User", entityId: user.id, meta });
  });
  return generic;
}

const setPasswordSchema = z
  .object({ token: z.string().min(10).max(200), password: z.string().max(200), confirm: z.string().max(200) })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

/** Completes an invite or a password reset. */
export async function setPasswordAction(input: z.input<typeof setPasswordSchema>): Promise<ActionResult> {
  const h = await headers();
  if (!isSameOrigin(h)) return fail("Request blocked (cross-site).");
  const parsed = setPasswordSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form");
  const token = await findValidToken(parsed.data.token, ["INVITE", "PASSWORD_RESET"]);
  if (!token) return fail("This link has expired or was already used. Ask for a new one.");
  const problem = passwordProblem(parsed.data.password, token.user.email);
  if (problem) return fail(problem);

  const passwordHash = await hashPassword(parsed.data.password);
  const meta = metaFromHeaders(h);
  const saved = await db.$transaction(async (tx) => {
    const claimed = await tx.authToken.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) return false;
    await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } },
    });
    await writeAudit(tx, {
      actor: token.user,
      module: "Auth",
      action: "update",
      text: token.type === "INVITE" ? `${token.user.name} accepted the invite and set a password` : `${token.user.name} reset their password`,
      entityType: "User",
      entityId: token.userId,
      meta,
    });
    return true;
  });
  if (!saved) return fail("This link was already used.");
  return ok("Password saved. Sign in with your new password.");
}

export const changePasswordAction = defineAction({
  schema: z
    .object({ current: z.string().min(1, "Enter your current password").max(200), next: z.string().max(200), confirm: z.string().max(200) })
    .refine((v) => v.next === v.confirm, { message: "New passwords don't match", path: ["confirm"] })
    .refine((v) => v.next !== v.current, { message: "Choose a password you haven't used here", path: ["next"] }),
  authorize: () => true, // only ever changes the caller's own password
  allowPasswordChange: true,
  handler: async ({ user, input, meta }) => {
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(row.passwordHash, input.current))) throw new UserError("Your current password is not right", { current: "Not right" });
    const problem = passwordProblem(input.next, user.email);
    if (problem) throw new UserError(problem, { next: problem });
    const passwordHash = await hashPassword(input.next);
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } } });
      await writeAudit(tx, { actor: user, module: "Auth", action: "update", text: `${user.name} changed their password`, entityType: "User", entityId: user.id, meta });
    });
    // Keep this device signed in with the new session version; every other session is now invalid.
    // (The mobile app has no cookie session: its route issues a fresh token instead.)
    if (!inMobileApi()) await unstable_update({});
    return ok("Password changed. Other devices have been signed out.");
  },
});
