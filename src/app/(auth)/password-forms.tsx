"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormError, inputClass } from "@/components/ui/field";
import { changePasswordAction, forgotPasswordAction, setPasswordAction } from "@/server/actions/auth";

function PasswordInput({ label, value, onChange, autoComplete, placeholder }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input type="password" autoComplete={autoComplete} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputClass("light", "h-11 px-3.5")} />
    </label>
  );
}

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await changePasswordAction({ current, next, confirm });
          if (!r.ok) return setError(r.error);
          router.replace("/dashboard");
          router.refresh();
        });
      }}
    >
      <PasswordInput label={forced ? "Temporary password" : "Current password"} value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordInput label="New password" value={next} onChange={setNext} autoComplete="new-password" placeholder="At least 10 characters" />
      <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      <FormError message={error} />
      <div className="flex gap-2">
        {!forced && (
          <Button variant="surface" size="xl" onClick={() => router.back()}>
            Back
          </Button>
        )}
        <Button type="submit" size="xl" loading={pending} className="flex-1">
          Save password
        </Button>
      </div>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <p role="status" className="m-0 rounded-row bg-[rgba(62,155,82,.14)] px-3 py-2 text-[13px]">
          {sent}
        </p>
        <Link href="/login" className="text-[13px]">
          ← Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await forgotPasswordAction({ email });
          if (!r.ok) return setError(r.error);
          setSent(r.message ?? "Check your inbox.");
        });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Work email</span>
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@patmichaels.in" className={inputClass("light", "h-11 px-3.5")} />
      </label>
      <FormError message={error} />
      <Button type="submit" size="xl" loading={pending} className="w-full">
        Send reset link
      </Button>
      <Link href="/login" className="-mt-1 text-[13px]">
        ← Back to sign in
      </Link>
    </form>
  );
}

export function SetPasswordForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setPasswordAction({ token, password, confirm });
          if (!r.ok) return setError(r.error);
          router.replace("/login?notice=reset");
        });
      }}
    >
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <PasswordInput label="New password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 10 characters" />
      <PasswordInput label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      <FormError message={error} />
      <Button type="submit" size="xl" loading={pending} className="w-full">
        Save password
      </Button>
    </form>
  );
}
