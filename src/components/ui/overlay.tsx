"use client";

import { useContext, useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CloseButton } from "./button";
import { cn } from "./cn";
import { ExitingContext, useLastWhile, usePresence } from "./motion";

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

/**
 * Mount state and content for an overlay that animates out: while closing it keeps showing what it last showed,
 * can't be clicked or focused (`inert`), and is gone after the exit animation.
 */
function useOverlayPresence(open: boolean, content: Pick<OverlayProps, "title" | "subtitle" | "children" | "footer">) {
  const { mounted, closing } = usePresence(open);
  const title = useLastWhile(open, content.title);
  const subtitle = useLastWhile(open, content.subtitle);
  const children = useLastWhile(open, content.children);
  const footer = useLastWhile(open, content.footer);
  return { mounted, closing, title, subtitle, children, footer };
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

/**
 * Right-side frosted-glass drawer (prototype: 520 px, inset 12 px, radius 28, slide-in). A long form scrolls
 * above the footer, so its actions stay in reach.
 */
export function Drawer({ open: requested, onClose, width = 520, className, ...content }: OverlayProps) {
  const exiting = useContext(ExitingContext);
  const open = requested && !exiting;
  const root = useOverlayRoot();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogBehaviour(open, onClose, panel);
  const { mounted, closing, title, subtitle, children, footer } = useOverlayPresence(open, content);
  if (!mounted || !root) return null;
  return createPortal(
    <div
      inert={closing}
      className={cn("absolute inset-0 z-[57] bg-backdrop backdrop-blur-[4px]", closing ? "pointer-events-none animate-fade-out" : "animate-fade-in")}
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "glass-strong absolute bottom-3 right-3 top-3 flex flex-col overflow-hidden rounded-panel shadow-panel outline-none",
          closing ? "animate-drawer-out" : "animate-drawer-in",
          className,
        )}
        style={{ width: `min(${width}px, calc(100% - 24px))` }}
      >
        <div className="pm-scroll flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden p-5">
          <Header titleId={titleId} title={title} subtitle={subtitle} onClose={onClose} />
          {children}
        </div>
        {footer && <div className="flex flex-none justify-end gap-2 px-5 pb-5">{footer}</div>}
      </div>
    </div>,
    root,
  );
}

/** Centred frosted-glass modal (prototype: max 640 px, radius 28). */
export function Modal({ open: requested, onClose, width = 640, className, stacked = false, ...content }: OverlayProps) {
  const exiting = useContext(ExitingContext);
  const open = requested && !exiting;
  const root = useOverlayRoot();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogBehaviour(open, onClose, panel);
  const { mounted, closing, title, subtitle, children, footer } = useOverlayPresence(open, content);
  if (!mounted || !root) return null;
  return createPortal(
    <div
      inert={closing}
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-backdrop p-4 backdrop-blur-[6px]",
        stacked ? "z-[59]" : "z-[55]",
        closing ? "pointer-events-none animate-fade-out" : "animate-fade-in",
      )}
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "pm-scroll glass-strong flex max-h-[calc(100%-32px)] w-full flex-col gap-4 overflow-y-auto rounded-panel p-5 shadow-panel outline-none",
          closing ? "animate-modal-out" : "animate-modal-in",
          className,
        )}
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
