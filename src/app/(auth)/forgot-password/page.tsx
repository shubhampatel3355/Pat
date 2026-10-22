import type { Metadata } from "next";
import { AuthScreen } from "../auth-card";
import { ForgotPasswordForm } from "../password-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthScreen title="Forgot password" subtitle="We'll email you a link to choose a new one.">
      <ForgotPasswordForm />
    </AuthScreen>
  );
}
