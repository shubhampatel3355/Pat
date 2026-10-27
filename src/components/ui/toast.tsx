"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "./cn";
import { useLastWhile, usePresence } from "./motion";

type Tone = "info" | "error";
interface ToastState {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<{ show: (message: string, tone?: Tone) => void } | null>(null);

export function ToastProvider({ children, bottom = 24 }: { children: React.ReactNode; bottom?: number }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((message: string, tone: Tone = "info") => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), tone === "error" ? 4000 : 2400);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  const value = useMemo(() => ({ show }), [show]);
  // The last toast stays on screen while it fades away.
  const { mounted, closing } = usePresence(toast !== null);
  const shown = useLastWhile(toast !== null, toast);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none absolute left-1/2 z-[60] -translate-x-1/2" style={{ bottom }}>
        {mounted && shown && (
          <div
            key={shown.id}
            className={cn(
              "glass-menu flex h-11 items-center gap-2.5 whitespace-nowrap rounded-pill px-[18px] text-[13px] shadow-glass",
              closing ? "animate-toast-out" : "animate-toast-in",
            )}
          >
            <span className="h-2 w-2 rounded-pill" style={{ background: shown.tone === "error" ? "var(--color-danger)" : "var(--color-primary)" }} />
            {shown.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/**
 * Run a server action inside a transition and toast its result.
 * Success messages come from the action; failures show the action's error.
 */
export function useAction<I, R>(
  action: (input: I) => Promise<ActionResult<R>>,
  opts: { onSuccess?: (result: Extract<ActionResult<R>, { ok: true }>) => void; onError?: (result: Extract<ActionResult<R>, { ok: false }>) => void; refresh?: boolean } = {},
) {
  const [pending, startTransition] = useTransition();
  const { show } = useToast();
  const router = useRouter();
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  const run = useCallback(
    (input: I) =>
      new Promise<ActionResult<R>>((resolve) => {
        startTransition(async () => {
          let result: ActionResult<R>;
          try {
            result = await action(input);
          } catch {
            result = { ok: false, error: "Network problem — please try again." };
          }
          if (result.ok) {
            if (result.message) show(result.message);
            optsRef.current.onSuccess?.(result);
            if (optsRef.current.refresh) router.refresh();
          } else {
            show(result.error, "error");
            optsRef.current.onError?.(result);
          }
          resolve(result);
        });
      }),
    [action, router, show],
  );

  return { run, pending };
}
