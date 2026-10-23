"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CloseButton } from "./button";
import { cn } from "./cn";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const noSubscribe = () => () => {};

/** Portal target: overlays live inside the rounded app frame, like the prototype (or <body> outside it). */
function useOverlayRoot(): HTMLElement | null {
  return useSyncExternalStore(
    noSubscribe,
    () => document.getElementById("pm-frame") ?? document.body,
    () => null,
  );
}

/** Open dialogs, oldest first: only the topmost one reacts to Escape and traps Tab (e.g. a confirm over a drawer). */
const openDialogs: symbol[] = [];

function useDialogBehaviour(open: boolean, onClose: () => void, panel: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const token = Symbol("dialog");
    openDialogs.push(token);
    const previous = document.activeElement as HTMLElement | null;
    const el = panel.current;
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el)?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== token) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      openDialogs.splice(openDialogs.indexOf(token), 1);
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, panel]);
}

function Header({ titleId, title, subtitle, onClose }: { titleId: string; title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex flex-1 flex-col gap-0.5">
        <h2 id={titleId} className="m-0 text-[22px] font-normal leading-7 tracking-[-.01em]">
          {title}
        </h2>
        {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
      </div>
      <CloseButton onClick={onClose} />
    </div>
  );
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  className?: string;
  /** Modal only: sit above drawers (confirmations opened from a drawer). */
  stacked?: boolean;
}

/** Right-side frosted-glass drawer (prototype: 520 px, inset 12 px, radius 28, slide-in). */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 520, className }: OverlayProps) {
  const root = useOverlayRoot();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogBehaviour(open, onClose, panel);
  if (!open || !root) return null;
  return createPortal(
    <div className="absolute inset-0 z-[57] bg-[rgba(2,62,125,.06)] backdrop-blur-[4px]" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "pm-scroll glass-strong absolute bottom-3 right-3 top-3 flex animate-slide-in flex-col gap-4 overflow-y-auto overflow-x-hidden rounded-panel p-5 shadow-panel outline-none",
          className,
        )}
        style={{ width: `min(${width}px, calc(100% - 24px))` }}
      >
        <Header titleId={titleId} title={title} subtitle={subtitle} onClose={onClose} />
        {children}
        {footer && (
          <>
            <div className="flex-1" />
            <div className="flex justify-end gap-2">{footer}</div>
          </>
        )}
      </div>
    </div>,
    root,
  );
}

/** Centred frosted-glass modal (prototype: max 640 px, radius 28). */
export function Modal({ open, onClose, title, subtitle, children, footer, width = 640, className, stacked = false }: OverlayProps) {
  const root = useOverlayRoot();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogBehaviour(open, onClose, panel);
  if (!open || !root) return null;
  return createPortal(
    <div className={cn("absolute inset-0 flex items-center justify-center bg-[rgba(2,62,125,.06)] p-4 backdrop-blur-[6px]", stacked ? "z-[59]" : "z-[55]")} onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn("pm-scroll glass-strong flex max-h-[calc(100%-32px)] w-full flex-col gap-4 overflow-y-auto rounded-panel p-5 shadow-panel outline-none", className)}
        style={{ maxWidth: width }}
      >
        <Header titleId={titleId} title={title} subtitle={subtitle} onClose={onClose} />
        {children}
        {footer && <div className="flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    root,
  );
}
