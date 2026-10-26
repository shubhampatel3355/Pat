"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Toggle } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { FormError, inputClass } from "@/components/ui/field";
import { googleLoginAction, loginAction } from "@/server/actions/auth";
import { AuthHeading } from "../auth-heading";

const RESEND_SECONDS = 30;
const EMPTY_CODE = ["", "", "", "", "", ""];

export function LoginForm({ googleEnabled, notice, next = "/dashboard" }: { googleEnabled: boolean; notice?: string | null; next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Owners and admins get a second step when the server asks for a sign-in code.
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);

  const signIn = (otp?: string) =>
    start(async () => {
      const result = await loginAction({ email, password, remember, ...(otp ? { otp } : {}) });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data?.otpSentTo) {
        setOtpSentTo(result.data.otpSentTo);
        return;
      }
      router.replace(next);
      router.refresh();
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid work email");
    if (!password) return setError("Enter your password");
    setError(null);
    signIn();
  };

  if (otpSentTo) {
    return (
      <OtpStep
        sentTo={otpSentTo}
        pending={pending}
        error={error}
        onEdit={() => setError(null)}
        onVerify={(code) => {
          setError(null);
          signIn(code);
        }}
        onResend={() => {
          setError(null);
          signIn();
        }}
        onBack={() => {
          setOtpSentTo(null);
          setError(null);
        }}
      />
    );
  }

  return (
    <>
      <AuthHeading title="Sign in" subtitle="Every lead, unit and rupee in one place." />
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
    </>
  );
}

/** The prototype's "Verify it's you" step: six boxes, a resend ring that empties over 30 s, Back. */
function OtpStep({
  sentTo,
  pending,
  error,
  onEdit,
  onVerify,
  onResend,
  onBack,
}: {
  sentTo: string;
  pending: boolean;
  error: string | null;
  onEdit: () => void;
  onVerify: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
}) {
  const [digits, setDigits] = useState(EMPTY_CODE);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const complete = digits.every(Boolean);

  useEffect(() => {
    boxes.current[0]?.focus();
  }, []);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // Typing, autofill and paste all land here; several digits fill forward from the box.
  const fill = (from: number, raw: string) => {
    const incoming = raw.replace(/\D/g, "");
    const nextDigits = [...digits];
    if (!incoming) nextDigits[from] = "";
    incoming
      .slice(0, 6 - from)
      .split("")
      .forEach((d, k) => (nextDigits[from + k] = d));
    setDigits(nextDigits);
    onEdit();
    if (incoming) boxes.current[Math.min(from + incoming.length, 5)]?.focus();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (complete && !pending) onVerify(digits.join(""));
  };

  return (
    <>
      <AuthHeading title="Verify it's you" subtitle={`Owner and admin accounts need a 6-digit code. We sent one to ${sentTo}.`} />
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div role="group" aria-label="Sign-in code" className="grid grid-cols-6 gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                boxes.current[i] = el;
              }}
              value={d}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1} of 6`}
              maxLength={6}
              // Two characters means a digit was typed next to the existing one: keep the new one.
              onChange={(e) => {
                const v = e.target.value;
                fill(i, d && v.length === 2 ? (v.startsWith(d) ? v.slice(1) : v.slice(0, 1)) : v);
              }}
              onPaste={(e) => {
                e.preventDefault();
                fill(i, e.clipboardData.getData("text"));
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !d && i > 0) boxes.current[i - 1]?.focus();
                if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
                if (e.key === "ArrowRight" && i < 5) boxes.current[i + 1]?.focus();
              }}
              onFocus={(e) => e.target.select()}
              className={inputClass("light", "h-14 text-center text-[22px] font-light")}
            />
          ))}
        </div>
        {error && (
          <div className="-mt-3">
            <FormError message={error} />
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <svg width="36" height="36" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="40" fill="none" className="stroke-chip" strokeWidth="8" />
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" strokeLinecap="round" pathLength={100} strokeDasharray={`${(wait / RESEND_SECONDS) * 100} 100`} transform="rotate(-90 50 50)" className="stroke-primary transition-[stroke-dasharray] duration-1000 ease-linear" />
          </svg>
          {wait > 0 ? (
            <span className="text-[13px] text-muted">
              Resend in 0:{String(wait).padStart(2, "0")}
            </span>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setDigits(EMPTY_CODE);
                setWait(RESEND_SECONDS);
                boxes.current[0]?.focus();
                onResend();
              }}
              className="hit-44 border-0 bg-transparent p-0 text-[13px] text-link"
            >
              Resend code
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="surface" size="xl" onClick={onBack} disabled={pending}>
            Back
          </Button>
          <Button type="submit" size="xl" loading={pending} disabled={!complete} className="flex-1">
            {pending ? "Verifying…" : "Verify & continue"}
          </Button>
        </div>
      </form>
    </>
  );
}
