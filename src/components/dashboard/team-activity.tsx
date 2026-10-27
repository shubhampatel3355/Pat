"use client";

import { useEffect, useState } from "react";
import type { IconName } from "@/lib/icons";
import { useLive, type LiveActivity } from "../shell/live";
import { Icon } from "../ui/icon";
import { Presence } from "../ui/motion";
import { DarkOverlay } from "./dark-overlay";

const MODULE_ICON: Record<string, IconName> = {
  WIP: "pipeline",
  Tasks: "check",
  "Business Development": "calendar",
  Vehicles: "car",
  Invoices: "finance",
  Finance: "finance",
  Teams: "user",
  Payroll: "payroll",
  Vault: "vault",
};

function age(at: string, now: number) {
  const sec = Math.max(0, Math.round((now - Date.parse(at)) / 1000));
  if (sec < 45) return "Just now";
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86_400) return `${Math.round(sec / 3600)} h ago`;
  return `${Math.round(sec / 86_400)} d ago`;
}

/** Dark hero button with a live ticker of the latest team activity; opens the full feed. */
export function TeamActivityButton() {
  const { activity } = useLive();
  const [open, setOpen] = useState(false);
  const rows = activity.slice(0, 6);
  const ticker = rows.length ? [...rows, ...rows] : [];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-blue-chip relative flex w-[300px] max-w-full flex-none items-center gap-3 overflow-hidden rounded-[18px] border-0 px-3.5 py-2 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_10px_24px_rgba(0,18,51,.22)] transition-transform duration-200 ease-spring hover:-translate-y-0.5 active:scale-[.97]"
      >
        <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-pill bg-white/16">
          <Icon name="user" size={16} color="#fff" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5 text-[13px] font-medium">
            Team activity
            <span className="flex items-center gap-1 text-[10px] font-medium opacity-90">
              <span className="h-1.5 w-1.5 rounded-pill bg-[#7CE3A1]" style={{ animation: "pmaGlow 1.6s ease-in-out infinite" }} />
              Live
            </span>
          </span>
          <span className="relative block h-4 overflow-hidden" aria-live="off">
            {ticker.length ? (
              <span className="flex flex-col" style={{ animation: `pmaTicker ${rows.length * 3}s steps(${rows.length}) infinite` }}>
                {ticker.map((t, i) => (
                  <span key={`${t.id}-${i}`} className="block h-4 truncate text-[11px] leading-4 opacity-92">
                    <b className="font-medium">{t.who}</b> {t.text}
                  </span>
                ))}
              </span>
            ) : (
              <span className="block h-4 truncate text-[11px] leading-4 opacity-92">Quiet so far today</span>
            )}
          </span>
        </span>
        <span className="text-sm" aria-hidden="true">
          ↗
        </span>
      </button>
      <Presence value={open}>{() => <TeamActivityModal rows={activity} onClose={() => setOpen(false)} />}</Presence>
    </>
  );
}

function TeamActivityModal({ rows, onClose }: { rows: LiveActivity[]; onClose: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <DarkOverlay onClose={onClose} label="Team activity">
      <div className="flex max-h-[calc(100%-32px)] w-full max-w-[480px] animate-modal-in flex-col gap-3 rounded-panel bg-surface p-[18px] shadow-[0_32px_90px_rgba(0,18,51,.35)]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-pill bg-primary">
            <Icon name="user" size={16} strokeWidth={1.6} color="#fff" />
          </span>
          <div className="flex flex-1 flex-col">
            <h2 className="m-0 text-lg font-medium">Team activity</h2>
            <span className="text-xs text-muted">What everyone is doing right now</span>
          </div>
          <span className="flex h-[22px] items-center gap-[5px] rounded-pill bg-[rgba(62,155,82,.16)] px-[9px] text-[10px] font-medium">
            <span className="h-1.5 w-1.5 rounded-pill bg-success" style={{ animation: "pmaGlow 1.6s ease-in-out infinite" }} />
            Live
          </span>
          <button type="button" onClick={onClose} title="Close" aria-label="Close" className="hit-44 h-[34px] w-[34px] rounded-pill border-0 bg-chip-2 text-base transition-colors hover:bg-raised">
            ×
          </button>
        </div>
        <ul className="pm-scroll m-0 flex max-h-[min(60vh,460px)] list-none flex-col gap-[3px] overflow-y-auto p-0">
          {rows.map((f) => (
            <li key={f.id} className="flex min-h-11 animate-item-in items-center gap-2 rounded-xl bg-field px-2 py-1">
              <span className="relative flex h-7 w-7 flex-none items-center justify-center rounded-pill bg-chip text-[10px] font-medium">
                {f.initials}
                <span className="absolute -bottom-[3px] -right-[3px] flex h-3.5 w-3.5 items-center justify-center rounded-pill bg-primary">
                  <Icon name={MODULE_ICON[f.module] ?? "check"} size={8} strokeWidth={2.4} color="#fff" />
                </span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs leading-4">
                  <span className="font-medium">{f.who}</span> {f.text}
                </span>
                <span className="text-[10px] text-muted">{age(f.at, now)}</span>
              </span>
            </li>
          ))}
          {rows.length === 0 && <li className="p-6 text-center text-xs text-muted">No activity yet.</li>}
        </ul>
      </div>
    </DarkOverlay>
  );
}
