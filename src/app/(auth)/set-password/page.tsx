import type { Metadata } from "next";
import Link from "next/link";
import { findValidToken } from "@/server/auth/tokens";
import { AuthScreen } from "../auth-card";
import { SetPasswordForm } from "../password-forms";

export const metadata: Metadata = { title: "Set password" };

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = typeof sp.token === "string" ? sp.token : "";
  const token = raw ? await findValidToken(raw, ["INVITE", "PASSWORD_RESET"]) : null;
  if (!token) {
    return (
      <AuthScreen title="Link expired" subtitle="This link has expired or was already used.">
        <Link href="/forgot-password" className="text-[13px]">
          Request a new link →
        </Link>
      </AuthScreen>
    );
  }
  const invite = token.type === "INVITE";
  return (
    <AuthScreen
      title={invite ? `Welcome, ${token.user.name.split(" ")[0]}` : "Choose a new password"}
      subtitle={invite ? `Set a password for ${token.user.email} to finish joining Pat Michaels OS.` : `For ${token.user.email}.`}
    >
      <SetPasswordForm token={raw} email={token.user.email} />
    </AuthScreen>
  );
}
