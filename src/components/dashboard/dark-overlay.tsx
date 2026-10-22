"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noSubscribe = () => () => {};

/** Dimmed navy backdrop used by the dashboard pop-ups (team activity, achievements). */
export function DarkOverlay({ onClose, label, children, animate = false }: { onClose: () => void; label: string; children: React.ReactNode; animate?: boolean }) {
  const root = useSyncExternalStore(noSubscribe, () => document.getElementById("pm-frame") ?? document.body, () => null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [onClose]);
  if (!root) return null;
  return createPortal(
    <div
      className="absolute inset-0 z-[58] flex items-center justify-center bg-[rgba(0,18,51,.45)] p-4 backdrop-blur-[8px]"
      style={animate ? { animation: "pmcBg .4s cubic-bezier(.22,1,.36,1) both" } : undefined}
      onClick={onClose}
    >
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()} className="flex max-h-full w-full justify-center">
        {children}
      </div>
    </div>,
    root,
  );
}
