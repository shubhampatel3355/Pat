"use client";

import { createContext, Fragment, useEffect, useState } from "react";
import { cn } from "./cn";

/** How long a closing overlay stays mounted for its exit animation — keep equal to --duration-exit in globals.css. */
export const EXIT_MS = 180;

/**
 * Keeps an overlay mounted while it animates out: open → mounted; closed → `closing` for EXIT_MS, then unmounted.
 * Reopening while it closes simply turns it back around.
 */
export function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open || !mounted) return;
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open, mounted]);
  return { mounted: open || mounted, closing: !open && mounted };
}

/**
 * `value` while `live`, then the last value seen while it was — so a closing dialog keeps its title and content
 * while it animates out, even after the caller has cleared the record it was showing.
 */
export function useLastWhile<T>(live: boolean, value: T): T {
  const [kept, setKept] = useState(value);
  if (live && kept !== value) setKept(value);
  return live ? value : kept;
}

/** True inside a <Presence> whose content is on its way out: Modal, Drawer and DarkOverlay play their exit. */
export const ExitingContext = createContext(false);

/**
 * For overlays rendered conditionally (`{record && <Modal …/>}`): renders `children(value)` while `value` is set,
 * then keeps the last one mounted for its exit animation.
 */
export function Presence<T>({ value, children }: { value: T | null | undefined | false; children: (value: T) => React.ReactNode }) {
  const live = value !== null && value !== undefined && value !== false;
  const { mounted } = usePresence(live);
  const held = useLastWhile(live, value);
  if (!mounted || held === null || held === undefined || held === false) return null;
  return <ExitingContext.Provider value={!live}>{children(held as T)}</ExitingContext.Provider>;
}

/** A hero heading's words rising in one after another. Only for welcome headings; the text reads normally. */
export function RevealWords({ text, step = 70 }: { text: string; step?: number }) {
  return text.split(" ").map((word, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <span className="inline-block animate-word-in" style={{ animationDelay: `${i * step}ms` }}>
        {word}
      </span>
    </Fragment>
  ));
}

/** Shows a figure; when it changes after the first render (a refresh brought new data) the new figure rises in. */
export function FreshValue({ value, className }: { value: string; className?: string }) {
  const [first] = useState(value);
  const [changed, setChanged] = useState(false);
  if (!changed && value !== first) setChanged(true);
  return (
    <span key={value} className={cn(changed && "inline-block animate-value-in", className)}>
      {value}
    </span>
  );
}
