import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { googleAuthEnabled } from "@/server/env";
import { AuthScreen } from "../auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  reset: "Password saved. Sign in with your new password.",
  AccessDenied: "That Google account doesn't have access. Ask an admin to invite you.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUser();
  if (user) redirect(user.mustChangePassword ? "/change-password" : "/dashboard");
  const sp = await searchParams;
  const key = typeof sp.notice === "string" ? sp.notice : typeof sp.error === "string" ? sp.error : null;
  // Only same-site paths ("/wip", not "//evil.com" or "https://…").
  const next = typeof sp.next === "string" && /^\/(?!\/)[\w\-/?=&%.]*$/.test(sp.next) ? sp.next : "/dashboard";
  return (
    <AuthScreen title="Sign in" subtitle="Every lead, unit and rupee in one place.">
      <LoginForm googleEnabled={googleAuthEnabled()} notice={key ? (NOTICES[key] ?? null) : null} next={next} />
    </AuthScreen>
  );
}
