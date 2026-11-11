import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { ApiError, request, setAuthHandlers, setToken } from "@/api/client";
import { loadApiUrl } from "@/api/config";
import type { LoginResponse, MeResponse, SessionToken } from "@/api/types";
import { useToast } from "@/components/toast";
import { storage } from "@/lib/storage";

/**
 * Who is signed in. The token lives in the device keychain (expo-secure-store) and goes out as a bearer
 * token; the server re-checks it on every request (deactivation or a password change elsewhere signs the
 * app out). "offline" means a saved session exists but the server couldn't be reached yet.
 */
type Status = "loading" | "signedOut" | "signedIn" | "offline";

type SignInResult = { ok: true } | { ok: false; error: string; otpRequired?: boolean; otpSentTo?: string };

interface SessionValue {
  status: Status;
  me: MeResponse | null;
  signIn: (email: string, password: string, otp?: string) => Promise<SignInResult>;
  signOut: (message?: string) => Promise<void>;
  /** Re-reads /me (role, permissions, menu); also renews the token when it is a day old. */
  refreshMe: () => Promise<void>;
  /** After a password change: the server hands back a fresh token. */
  adoptToken: (session: SessionToken) => Promise<void>;
  retry: () => void;
}

const KEY = "pm.session";
const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside SessionProvider");
  return ctx;
}

/** The signed-in user's data; only for screens behind the signed-in guard. */
export function useMe(): MeResponse {
  const { me } = useSession();
  if (!me) throw new Error("useMe without a session");
  return me;
}

async function storeToken(session: SessionToken | null) {
  setToken(session?.token ?? null);
  if (session) await storage.set(KEY, JSON.stringify(session));
  else await storage.remove(KEY);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [attempt, setAttempt] = useState(0);
  const queryClient = useQueryClient();
  const toast = useToast();
  const signingOut = useRef(false);

  const loadMe = useCallback(async () => {
    const data = await request<MeResponse>("/api/mobile/v1/me");
    if (data.session) await storeToken(data.session);
    setMe(data);
    setStatus("signedIn");
  }, []);

  const signOut = useCallback(
    async (message?: string) => {
      if (signingOut.current) return;
      signingOut.current = true;
      try {
        if (!message) await request("/api/mobile/v1/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
        await storeToken(null);
        queryClient.clear();
        setMe(null);
        setStatus("signedOut");
        if (message) toast.show(message, "info");
      } finally {
        signingOut.current = false;
      }
    },
    [queryClient, toast],
  );

  // Restore a saved session on launch (and on "Try again" after a network failure).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadApiUrl();
      const saved = await storage.get(KEY).catch(() => null);
      const session = saved ? (JSON.parse(saved) as SessionToken) : null;
      if (!session || Date.parse(session.expiresAt) < Date.now()) {
        await storeToken(null);
        if (!cancelled) setStatus("signedOut");
        return;
      }
      setToken(session.token);
      try {
        await loadMe();
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) setStatus("signedOut");
        else setStatus("offline");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, loadMe]);

  // The API client reports an ended session (401) or a forced password change (403).
  useEffect(() => {
    setAuthHandlers({
      signedOut: (message) => void signOut(message ?? "Your session has ended. Please sign in again."),
      passwordChange: () => setMe((m) => (m ? { ...m, user: { ...m.user, mustChangePassword: true } } : m)),
    });
  }, [signOut]);

  // Back in the foreground: re-check the session and permissions.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && status === "signedIn") loadMe().catch(() => undefined);
    });
    return () => sub.remove();
  }, [status, loadMe]);

  const signIn = useCallback(
    async (email: string, password: string, otp?: string): Promise<SignInResult> => {
      const res = await request<LoginResponse>("/api/mobile/v1/auth/login", { method: "POST", body: { email, password, ...(otp ? { otp } : {}) }, auth: false });
      if (!res.ok) return res;
      await storeToken({ token: res.token, expiresAt: res.expiresAt });
      queryClient.clear();
      await loadMe();
      return { ok: true };
    },
    [loadMe, queryClient],
  );

  const adoptToken = useCallback(
    async (session: SessionToken) => {
      await storeToken(session);
      await loadMe();
    },
    [loadMe],
  );

  const value = useMemo<SessionValue>(
    () => ({ status, me, signIn, signOut, refreshMe: loadMe, adoptToken, retry: () => setAttempt((n) => n + 1) }),
    [status, me, signIn, signOut, loadMe, adoptToken],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
