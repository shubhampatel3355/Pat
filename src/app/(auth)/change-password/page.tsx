import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { AuthScreen } from "../auth-card";
import { ChangePasswordForm } from "../password-forms";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  return (
    <AuthScreen
      title={user.mustChangePassword ? "Choose your password" : "Change password"}
      subtitle={user.mustChangePassword ? `Welcome, ${user.firstName}. Replace the temporary password before you continue.` : "Other devices will be signed out."}
    >
      <ChangePasswordForm forced={user.mustChangePassword} />
    </AuthScreen>
  );
}
