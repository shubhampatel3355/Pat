"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IconName } from "@/lib/icons";
import { Icon } from "../ui/icon";
import type { ShellNavGroup } from "./types";

interface SearchItem {
  label: string;
  meta: string;
  href: string;
  icon: IconName;
}
interface SearchGroup {
  label: string;
  items: SearchItem[];
}

/** ⌘K palette: pages (filtered locally) + records from /api/search (permission-scoped on the server). */
export function CommandPalette({ open, onClose, nav }: { open: boolean; onClose: () => void; nav: ShellNavGroup[] }) {
  // Mounted fresh on every open, so query and results always start empty.
  return open ? <Palette onClose={onClose} nav={nav} /> : null;
}

function Palette({ onClose, nav }: { onClose: () => void; nav: ShellNavGroup[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ q: string; groups: SearchGroup[] }>({ q: "", groups: [] });
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: ctrl.signal, cache: "no-store" });
        if (res.ok) setResults({ q: trimmed, groups: ((await res.json()) as { groups: SearchGroup[] }).groups });
      } catch {
        /* aborted */
      }
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [trimmed]);

  const groups = useMemo(() => {
    const remote = trimmed.length >= 2 && results.q === trimmed ? results.groups : [];
    const q = trimmed.toLowerCase();
    const pages: SearchGroup = {
      label: "Pages",
      items: nav
        .flatMap((g) => g.items.map((i) => ({ label: i.label, meta: `${g.label} · ${i.href}`, href: i.href, icon: i.icon })))
        .filter((i) => !q || `${i.label} ${i.meta}`.toLowerCase().includes(q)),
    };
    return [...remote, pages].filter((g) => g.items.length);
  }, [nav, trimmed, results]);

  const flat = groups.flatMap((g) => g.items);

  const go = (item: SearchItem | undefined) => {
    if (!item) return;
    onClose();
    router.push(item.href);
  };

  return (
    <div className="absolute inset-0 z-50 flex animate-fade-in items-start justify-center bg-backdrop px-4 pb-4 pt-20 backdrop-blur-[6px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onClick={(e) => e.stopPropagation()}
        className="glass-menu flex w-full max-w-[640px] origin-top animate-pop-in flex-col gap-2 rounded-panel p-3 shadow-panel"
      >
        <div className="flex h-12 items-center gap-2.5 rounded-pill bg-surface px-3.5">
          <Icon name="search" size={18} />
          <input
            ref={input}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(flat.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(flat[active]);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search tenants, meetings, invoices, people, pages…"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="pm-cmd-results"
            aria-activedescendant={flat[active] ? `pm-cmd-${active}` : undefined}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
          />
          <span className="rounded-pill bg-card px-2 py-0.5 text-[11px] text-muted">Esc</span>
        </div>
        <div id="pm-cmd-results" role="listbox" className="pm-scroll flex max-h-[52vh] flex-col gap-2.5 overflow-y-auto p-1">
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col gap-0.5">
              <span className="px-2 py-1 text-[11px] text-muted">{g.label}</span>
              {g.items.map((item) => {
                const index = flat.indexOf(item);
                return (
                  <button
                    key={`${g.label}-${item.href}-${item.label}`}
                    id={`pm-cmd-${index}`}
                    role="option"
                    aria-selected={index === active}
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(item)}
                    className={`flex min-h-12 items-center gap-3 rounded-row border-0 px-2.5 py-1.5 text-left transition-colors duration-100 ${index === active ? "bg-raised/70" : "bg-transparent"}`}
                  >
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-surface">
                      <Icon name={item.icon} size={14} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm">{item.label}</span>
                      <span className="truncate text-xs text-muted">{item.meta}</span>
                    </span>
                    <span className="text-sm text-muted" aria-hidden="true">
                      ↗
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          {!groups.length && <span className="p-6 text-center text-sm text-muted">No matches for “{query}”.</span>}
        </div>
        <div className="flex gap-3.5 px-2.5 py-1 text-[11px] text-muted">
          <span>↵ Open</span>
          <span>⌘K Toggle</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
