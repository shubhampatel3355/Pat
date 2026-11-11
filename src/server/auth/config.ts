import "server-only";
import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { writeAudit } from "../audit";
import { db } from "../db";
import { env, googleAuthEnabled } from "../env";
import { logger } from "../logger";
import { LIMITS, rateLimit } from "../rate-limit";
import { metaFromHeaders } from "../request";
import { verifyPassword } from "./password";
import { issueLoginOtp, verifyLoginOtp } from "./tokens";

class InvalidCredentials extends CredentialsSignin {
  code = "invalid";
}
class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}
/** Password was right; an owner/admin must now enter the emailed sign-in code. */
class OtpRequired extends CredentialsSignin {
  code = "otp_required";
}
class InvalidOtp extends CredentialsSignin {
  code = "otp_invalid";
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
  remember: z.enum(["1", "0"]).optional(),
  otp: z.string().regex(/^\d{6}$/).optional(),
});

/** Also used by the mobile app's sign-in (src/app/api/mobile/v1/auth/login), so both apply the same rules. */
export async function authorizeWithPassword(raw: Partial<Record<string, unknown>>, request: Request) {
  const meta = metaFromHeaders(request.headers);
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidCredentials();
  const { email, password, remember, otp } = parsed.data;

  const [byIp, byEmail] = await Promise.all([
    rateLimit(`login:ip:${meta.ip ?? "unknown"}`, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.windowSec),
    rateLimit(`login:email:${email}`, LIMITS.loginPerEmail.limit, LIMITS.loginPerEmail.windowSec),
  ]);
  if (!byIp.ok || !byEmail.ok) {
    await writeAudit(db, { actor: null, module: "Auth", action: "login_failed", text: `Sign-in throttled for ${email}`, meta });
    throw new TooManyAttempts();
  }

  const user = await db.user.findFirst({ where: { email, deletedAt: null } });
  const ok = await verifyPassword(user?.passwordHash, password);
  if (!user || !ok || !user.active) {
    await writeAudit(db, {
      actor: user ? { id: user.id, name: user.name } : null,
      module: "Auth",
      action: "login_failed",
      text: user && ok && !user.active ? `Sign-in refused for deactivated account ${email}` : `Failed sign-in for ${email}`,
      entityType: "User",
      entityId: user?.id,
      meta,
    });
    throw new InvalidCredentials();
  }

  // Second factor for owners and admins: an emailed six-digit code.
  if (env().AUTH_OTP_FOR_ADMINS && (user.role === "OWNER" || user.role === "ADMIN")) {
    if (!otp) {
      await issueLoginOtp(user);
      await writeAudit(db, { actor: user, module: "Auth", action: "login", text: `Sign-in code sent to ${user.name}`, entityType: "User", entityId: user.id, meta });
      throw new OtpRequired();
    }
    if (!(await verifyLoginOtp(user.id, otp))) {
      await writeAudit(db, { actor: user, module: "Auth", action: "login_failed", text: `Wrong or expired sign-in code for ${user.name}`, entityType: "User", entityId: user.id, meta });
      throw new InvalidOtp();
    }
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit(db, { actor: user, module: "Auth", action: "login", text: `${user.name} signed in${otp ? " (with a sign-in code)" : ""}`, entityType: "User", entityId: user.id, meta });
  return { id: user.id, email: user.email, name: user.name, remember: remember === "1", sessionVersion: user.sessionVersion };
}

function buildConfig(): NextAuthConfig {
  const e = env();
  const providers: NextAuthConfig["providers"] = [
    Credentials({
      id: "credentials",
      credentials: { email: {}, password: {}, remember: {}, otp: {} },
      authorize: authorizeWithPassword,
    }),
  ];
  if (googleAuthEnabled()) {
    providers.push(Google({ clientId: e.AUTH_GOOGLE_ID, clientSecret: e.AUTH_GOOGLE_SECRET }));
  }

  return {
    secret: e.AUTH_SECRET,
    trustHost: true,
    session: { strategy: "jwt", maxAge: e.AUTH_REMEMBER_DAYS * 24 * 60 * 60 },
    pages: { signIn: "/login", error: "/login" },
    providers,
    logger: {
      error: (error) => logger.warn({ err: error.message, name: error.name }, "auth error"),
      warn: (code) => logger.warn({ code }, "auth warning"),
    },
    callbacks: {
      // Google SSO is only for people who already have an active account with the same (verified) email.
      async signIn({ account, profile, user }) {
        if (account?.provider !== "google") return true;
        const email = profile?.email?.toLowerCase();
        if (!email || profile?.email_verified !== true) return false;
        const existing = await db.user.findFirst({ where: { email, deletedAt: null, active: true } });
        if (!existing) {
          await writeAudit(db, { actor: null, module: "Auth", action: "login_failed", text: `Google sign-in refused for ${email} (no account)` });
          return false;
        }
        user.id = existing.id;
        user.sessionVersion = existing.sessionVersion;
        await db.user.update({ where: { id: existing.id }, data: { lastLoginAt: new Date() } });
        await writeAudit(db, { actor: existing, module: "Auth", action: "login", text: `${existing.name} signed in with Google`, entityType: "User", entityId: existing.id });
        return true;
      },
      async jwt({ token, user, trigger }) {
        const now = Math.floor(Date.now() / 1000);
        if (user?.id) {
          token.uid = user.id;
          token.sv = user.sessionVersion ?? 0;
          token.rexp = now + (user.remember ? e.AUTH_REMEMBER_DAYS * 86_400 : e.AUTH_SESSION_HOURS * 3_600);
        }
        if (trigger === "update" && token.uid) {
          // Re-issued after a password change on this device: pick up the new session version.
          const fresh = await db.user.findUnique({ where: { id: token.uid }, select: { sessionVersion: true } });
          if (fresh) token.sv = fresh.sessionVersion;
        }
        if (!token.uid || (token.rexp && token.rexp < now)) return null;
        return token;
      },
      session({ session, token }) {
        session.user.id = token.uid as string;
        session.sv = token.sv;
        return session;
      },
    },
    events: {
      async signOut(message) {
        const uid = "token" in message ? message.token?.uid : undefined;
        if (!uid) return;
        const user = await db.user.findUnique({ where: { id: uid }, select: { id: true, name: true } });
        if (user) await writeAudit(db, { actor: user, module: "Auth", action: "logout", text: `${user.name} signed out`, entityType: "User", entityId: user.id });
      },
    },
  };
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(() => buildConfig());
