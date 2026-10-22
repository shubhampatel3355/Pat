"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Toggle } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { FormError, inputClass } from "@/components/ui/field";
import { googleLoginAction, loginAction } from "@/server/actions/auth";

export function LoginForm({ googleEnabled, notice, next = "/dashboard" }: { googleEnabled: boolean; notice?: string | null; next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid work email");
    if (!password) return setError("Enter your password");
    setError(null);
    start(async () => {
      const result = await loginAction({ email, password, remember });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(next);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {notice && (
        <p role="status" className="m-0 -mt-1 rounded-row bg-[rgba(62,155,82,.14)] px-3 py-2 text-[13px]">
          {notice}
        </p>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Work email</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="you@patmichaels.in"
          className={inputClass("light", "h-11 px-3.5")}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          placeholder="At least 10 characters"
          className={inputClass("light", "h-11 px-3.5")}
        />
      </label>
      {error && (
        <div className="-mt-3">
          <FormError message={error} />
        </div>
      )}
      <div className="flex items-center justify-between">
        <Toggle checked={remember} onChange={setRemember} label="Remember this device" showLabel />
        <Link href="/forgot-password" className="text-[13px]">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="xl" loading={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      {googleEnabled && (
        <Button variant="surface" size="xl" className="-mt-2 w-full" onClick={() => start(() => googleLoginAction())}>
          Continue with Google
        </Button>
      )}
    </form>
  );
}
