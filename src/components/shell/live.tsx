"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export interface LiveNotification {
  id: string;
  text: string;
  href: string | null;
  at: string;
  read: boolean;
}

export interface LiveActivity {
  id: string;
  initials: string;
  who: string;
  text: string;
  module: string;
  at: string;
}

export interface LiveAchievement {
  id: string;
  title: string;
  meta: string | null;
  value: string | null;
  at: string;
}

export interface LiveSnapshot {
  unread: number;
  notifications: LiveNotification[];
  activity: LiveActivity[];
  /** Achievements newer than the user's last view — triggers the celebration pop-up. */
  newAchievements: LiveAchievement[];
}

interface LiveContextValue extends LiveSnapshot {
  refresh: () => void;
  markAllReadLocally: () => void;
}

const LiveContext = createContext<LiveContextValue | null>(null);

const POLL_MS = 15_000;

/** Polls /api/live (notifications + team activity) while the tab is visible. */
export function LiveProvider({ initial, children }: { initial: LiveSnapshot; children: React.ReactNode }) {
  const [snap, setSnap] = useState<LiveSnapshot>(initial);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current || document.visibilityState !== "visible") return;
    inflight.current = true;
    try {
      const res = await fetch("/api/live", { cache: "no-store", headers: { accept: "application/json" } });
      if (res.ok) setSnap((await res.json()) as LiveSnapshot);
    } catch {
      // Offline or deploy in progress — try again on the next tick.
    } finally {
      inflight.current = false;
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const markAllReadLocally = useCallback(() => {
    setSnap((s) => ({ ...s, unread: 0, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
  }, []);

  const value = useMemo(() => ({ ...snap, refresh, markAllReadLocally }), [snap, refresh, markAllReadLocally]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive must be used inside <LiveProvider>");
  return ctx;
}
