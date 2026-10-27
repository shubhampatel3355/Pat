"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { formatDayMonth, formatTime12, isoDateIST, addDaysIso, timeIST } from "@/lib/dates";
import { BRAND_MARK } from "@/lib/icons";
import { markNotificationsReadAction, setViewAction, signOutAction } from "@/server/actions/shell";
import { cn } from "../ui/cn";
import { Icon } from "../ui/icon";
import { SvgDefs } from "../ui/ring";
import { ToastProvider } from "../ui/toast";
import { useDismiss } from "../ui/use-dismiss";
import { ThemeSwitch } from "../theme/theme-switch";
import { CelebrationWatcher } from "./celebration-watcher";
import { CommandPalette } from "./command-palette";
import { LiveProvider, useLive, type LiveSnapshot } from "./live";
import type { ShellNavGroup, ShellQuickItem, ShellUser, ShellView } from "./types";

const RAISED = "bg-surface shadow-raised";

interface AppShellProps {
  user: ShellUser;
  nav: ShellNavGroup[];
  quickCreate: ShellQuickItem[];
  view: ShellView;
  live: LiveSnapshot;
  children: React.ReactNode;
}

export function AppShell({ user, nav, quickCreate, view, live, children }: AppShellProps) {
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <LiveProvider initial={live}>
      {/* The app fills the window (the prototype floats this frame on the blue background with a margin). */}
      <div className="flex h-dvh">
        <div id="pm-frame" className="relative min-w-0 flex-1 overflow-hidden bg-frame">
          <SvgDefs />
          <a href="#pm-content" className="sr-only-focusable rounded-pill bg-raised px-4 py-2 text-sm">
            Skip to content
          </a>
          <ToastProvider>
            <TopBar user={user} quickCreate={quickCreate} view={view} onOpenSearch={() => setCmdOpen(true)} />
            <Rail nav={nav} />
            <main id="pm-content" tabIndex={-1} className="pm-scroll absolute bottom-0 left-[76px] right-0 top-[68px] overflow-y-auto pb-8 pr-6 outline-none max-md:left-3 max-md:pb-24 max-md:pr-3">
              {children}
            </main>
            <MobileNav nav={nav} onMore={() => setCmdOpen(true)} />
            <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} nav={nav} />
            <CelebrationWatcher />
          </ToastProvider>
        </div>
      </div>
    </LiveProvider>
  );
}

// ── Top bar ────────────────────────────────────────────────────────────────────

const noSubscribe = () => () => {};

function TopBar({ user, quickCreate, view, onOpenSearch }: { user: ShellUser; quickCreate: ShellQuickItem[]; view: ShellView; onOpenSearch: () => void }) {
  const router = useRouter();
  const isMac = useSyncExternalStore(
    noSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => true,
  );

  return (
    <header className="absolute left-0 right-0 top-0 z-30 flex h-[68px] items-center justify-between gap-2 px-3 py-3.5">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/dashboard" title="Dashboard" aria-label="Dashboard" className={cn("hit-44 flex h-10 w-10 flex-none items-center justify-center rounded-pill", RAISED)}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d={BRAND_MARK} style={{ fill: "light-dark(#023E7D, #9CC3FF)" }} />
          </svg>
        </Link>
        <button type="button" onClick={() => router.back()} title="Back" aria-label="Back" className={cn("hit-44 flex h-10 w-10 flex-none items-center justify-center rounded-pill border-0 transition-transform duration-150 hover:bg-field active:scale-[.97]", RAISED)}>
          <Icon name="back" size={18} />
        </button>
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search"
          aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
          className={cn("hit-44 flex h-10 flex-none items-center gap-2.5 rounded-pill border-0 pl-[11px] pr-3.5 text-[13px] text-muted hover:bg-field", RAISED)}
        >
          <Icon name="search" size={18} color="var(--color-ink)" />
          <span className="max-md:hidden">Search</span>
          <span className="rounded-pill bg-card px-[7px] py-0.5 text-[11px] max-md:hidden">{isMac ? "⌘K" : "Ctrl K"}</span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        {view.canSwitch && view.partners.length > 0 && <ViewSwitch view={view} />}
        {quickCreate.length > 0 && <QuickCreate items={quickCreate} />}
        <ProfileMenu user={user} />
        <Notifications />
      </div>
    </header>
  );
}

function ViewSwitch({ view }: { view: ShellView }) {
  const [pending, start] = useTransition();
  const [current, setOptimistic] = useOptimistic(view.value);
  const index = current === "company" ? -1 : view.partners.findIndex((p) => p.id === current);
  const choose = (value: string) => {
    if (value === current) return;
    start(async () => {
      setOptimistic(value);
      await setViewAction({ view: value });
    });
  };
  return (
    <div className="relative flex h-10 gap-0.5 rounded-pill bg-card p-1 max-md:hidden" role="radiogroup" aria-label="Company or partner view" aria-busy={pending || undefined}>
      <span
        aria-hidden="true"
        className="absolute left-1 top-1 h-8 rounded-pill bg-surface shadow-seg transition-[transform,width] duration-300 ease-spring"
        style={{ width: index < 0 ? 92 : 40, transform: `translateX(${index < 0 ? 0 : 94 + 42 * index}px)` }}
      />
      <button
        type="button"
        role="radio"
        aria-checked={index < 0}
        onClick={() => choose("company")}
        className={cn("relative h-8 w-[92px] rounded-pill border-0 bg-transparent text-[13px] font-medium", index < 0 ? "text-ink" : "text-muted")}
      >
        Company
      </button>
      {view.partners.map((p, i) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={index === i}
          aria-label={`${p.name} · Partner View`}
          title={`${p.name} · Partner View`}
          onClick={() => choose(p.id)}
          className="relative flex h-8 w-10 items-center justify-center rounded-pill border-0 bg-transparent"
        >
          <span
            className="flex h-[26px] w-[26px] items-center justify-center rounded-pill text-[11px] font-medium shadow-avatar"
            style={{ background: index === i ? "var(--color-primary)" : "var(--color-chip)", color: index === i ? "#fff" : "var(--color-muted-strong)" }}
          >
            {p.initials}
          </span>
        </button>
      ))}
    </div>
  );
}

function QuickCreate({ items }: { items: ShellQuickItem[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Quick create"
        aria-label="Quick create"
        aria-expanded={open}
        aria-haspopup="menu"
        className="hit-44 flex h-10 w-10 items-center justify-center rounded-pill border-0 bg-primary text-white shadow-primary transition-transform duration-150 hover:bg-primary-hover active:scale-[.97]"
      >
        <Icon name="plus" size={18} strokeWidth={1.6} />
      </button>
      {open && (
        <div role="menu" className="glass-menu absolute right-0 top-12 z-40 flex w-[220px] flex-col gap-0.5 rounded-[20px] p-2 shadow-glass">
          <span className="px-2.5 py-1.5 text-[11px] text-muted">Create new</span>
          {items.map((q) => (
            <Link key={q.label} href={q.href} role="menuitem" onClick={close} className="flex h-10 items-center gap-2.5 rounded-[14px] px-2 text-left text-sm text-ink hover:bg-raised/70 hover:text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-surface">
                <Icon name={q.icon} size={14} />
              </span>
              {q.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const [signingOut, start] = useTransition();
  return (
    <div ref={ref} className="relative">
      {/* Phones show the avatar only; the menu (change password, sign out) is the same everywhere. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account: ${user.name}`}
        className="glass flex h-10 items-center gap-2.5 rounded-pill py-[3px] pl-[3px] pr-4 text-left max-md:pr-[3px]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-primary text-[11px] font-medium text-white shadow-avatar">{user.initials}</span>
        <span className="flex flex-col leading-[1.15] max-md:hidden">
          <span className="text-[13px] font-medium">{user.name}</span>
          <span className="text-[11px] text-muted">{user.email}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="glass-menu absolute right-0 top-12 z-40 flex w-[220px] flex-col gap-0.5 rounded-[20px] p-2 shadow-glass">
          <span className="px-2.5 py-1.5 text-[11px] text-muted">
            Signed in as {user.role === "OWNER" ? "Owner" : user.role === "ADMIN" ? "Admin" : "Employee"}
          </span>
          <div className="flex h-10 items-center justify-between gap-2 px-2.5">
            <span className="text-sm text-ink">Dark mode</span>
            <ThemeSwitch />
          </div>
          <Link href="/change-password" role="menuitem" onClick={close} className="flex h-10 items-center gap-2.5 rounded-[14px] px-2 text-sm text-ink hover:bg-raised/70 hover:text-ink">
            <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-surface">
              <Icon name="key" size={14} />
            </span>
            Change password
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={() => start(() => signOutAction())}
            className="flex h-10 items-center gap-2.5 rounded-[14px] border-0 bg-transparent px-2 text-left text-sm hover:bg-raised/70"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-surface">
              <Icon name="logout" size={14} />
            </span>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

function notificationTime(at: string, today: string) {
  const d = new Date(at);
  const day = isoDateIST(d);
  if (day === today) return formatTime12(timeIST(d));
  if (day === addDaysIso(today, -1)) return "Yesterday";
  return formatDayMonth(day);
}

function Notifications() {
  const live = useLive();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const router = useRouter();
  const today = isoDateIST(new Date());
  const groups = [
    { label: "Today", items: live.notifications.filter((n) => isoDateIST(new Date(n.at)) === today) },
    { label: "Earlier", items: live.notifications.filter((n) => isoDateIST(new Date(n.at)) !== today) },
  ].filter((g) => g.items.length);

  const markAll = async () => {
    live.markAllReadLocally();
    await markNotificationsReadAction({});
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label={live.unread ? `Notifications, ${live.unread} unread` : "Notifications"}
        aria-expanded={open}
        className={cn("hit-44 relative flex h-10 w-10 items-center justify-center rounded-pill border-0 hover:bg-field", RAISED)}
      >
        <Icon name="bell" size={18} />
        {live.unread > 0 && <span className="absolute right-2.5 top-[9px] h-[7px] w-[7px] rounded-pill bg-primary shadow-[0_0_0_2px_var(--color-surface)]" />}
      </button>
      {open && (
        <div className="glass-strong absolute right-0 top-12 z-40 flex w-[min(340px,86vw)] flex-col gap-2.5 rounded-[20px] p-3.5 shadow-glass">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Notifications</span>
            <button type="button" onClick={markAll} className="border-0 bg-transparent p-0 text-xs text-primary">
              Mark all read
            </button>
          </div>
          {groups.length === 0 && <span className="px-1 py-3 text-[13px] text-muted">You&apos;re all caught up.</span>}
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col gap-1">
              <span className="px-1 py-0.5 text-[11px] text-muted">{g.label}</span>
              {g.items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (n.href) {
                      close();
                      router.push(n.href);
                    }
                    if (!n.read) void markNotificationsReadAction({ ids: [n.id] }).then(() => live.refresh());
                  }}
                  className="flex gap-2.5 rounded-[14px] border-0 bg-raised/45 p-2 text-left"
                >
                  <span className="mt-1.5 h-[7px] w-[7px] flex-none rounded-pill" style={{ background: n.read ? "var(--color-chip)" : "var(--color-primary)" }} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13px] leading-[18px]">{n.text}</span>
                    <span className="text-[11px] text-muted">{notificationTime(n.at, today)}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mobile bottom bar (prototype: Home · WIP · Follow-ups · More) ───────────────

function MobileNav({ nav, onMore }: { nav: ShellNavGroup[]; onMore: () => void }) {
  const pathname = usePathname();
  const allowed = new Set(nav.flatMap((g) => g.items.map((i) => i.href)));
  const items = (
    [
      ["/dashboard", "Home", "dashboard"],
      ["/wip", "WIP", "leads"],
      ["/follow-ups", "Follow-ups", "followups"],
    ] as const
  ).filter(([href]) => allowed.has(href));
  const button = (active: boolean) =>
    cn(
      "flex h-12 w-12 items-center justify-center rounded-pill border-0 transition-colors duration-200",
      active ? "bg-primary text-white shadow-primary" : "bg-transparent text-ink",
    );
  return (
    <nav aria-label="Mobile" className="glass absolute bottom-3 left-3 right-3 z-30 flex h-16 items-center justify-around rounded-pill px-2 shadow-glass md:hidden">
      {items.map(([href, label, icon]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} title={label} aria-label={label} aria-current={active ? "page" : undefined} className={button(active)}>
            <Icon name={icon} size={20} />
          </Link>
        );
      })}
      <button type="button" onClick={onMore} title="More" aria-label="More pages and search" className={button(false)}>
        <Icon name="more" size={20} />
      </button>
    </nav>
  );
}

// ── Rail ───────────────────────────────────────────────────────────────────────

function Rail({ nav }: { nav: ShellNavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, start] = useTransition();
  return (
    <nav
      aria-label="Main"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      className="pm-scroll absolute bottom-2 left-1.5 top-[72px] z-[25] flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden rounded-card p-1.5 transition-[width,background-color,box-shadow] duration-300 ease-spring max-md:hidden"
      style={{
        width: open ? 232 : 52,
        background: open ? "light-dark(rgba(244,244,244,.62), rgba(28,31,36,.86))" : "transparent",
        backdropFilter: open ? "blur(24px)" : "none",
        WebkitBackdropFilter: open ? "blur(24px)" : "none",
        boxShadow: open ? "var(--shadow-glass)" : "none",
      }}
    >
      {nav.map((g) => (
        <div key={g.label} className="flex flex-col gap-1.5">
          <span
            className="flex items-end overflow-hidden whitespace-nowrap pl-3 text-[11px] text-muted transition-[height,opacity] duration-300"
            style={{ height: open ? 18 : 0, opacity: open ? 1 : 0 }}
          >
            {g.label}
          </span>
          {g.items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
            return (
              <Link
                key={it.href}
                href={it.href}
                title={it.label}
                aria-current={active ? "page" : undefined}
                className="flex h-10 items-center gap-3 whitespace-nowrap rounded-pill text-left text-ink transition-colors duration-200 hover:bg-raised/45 hover:text-ink"
              >
                <span
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-pill transition-[background-color,color] duration-300 ease-spring"
                  style={{
                    background: active ? "var(--color-primary)" : "var(--color-surface)",
                    color: active ? "#fff" : "var(--color-ink)",
                    boxShadow: active ? "var(--shadow-primary)" : "var(--shadow-raised)",
                  }}
                >
                  <Icon name={it.icon} size={18} />
                </span>
                <span className="text-[13px] font-medium transition-opacity duration-200" style={{ opacity: open ? 1 : 0 }}>
                  {it.label}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
      <div className="min-h-1.5 flex-1" />
      <button
        type="button"
        title="Log out"
        disabled={signingOut}
        onClick={() => start(() => signOutAction())}
        className="flex h-10 flex-none items-center gap-3 whitespace-nowrap rounded-pill border-0 bg-transparent p-0 hover:bg-raised/45"
      >
        <span className={cn("flex h-10 w-10 flex-none items-center justify-center rounded-pill", RAISED)}>
          <Icon name="logout" size={18} />
        </span>
        <span className="text-[13px] font-medium" style={{ opacity: open ? 1 : 0 }}>
          Log out
        </span>
      </button>
    </nav>
  );
}
