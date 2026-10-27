"use client";

import { useEffect, useState } from "react";
import { formatCompactINR } from "@/lib/money";
import type { IconName } from "@/lib/icons";
import { markAchievementsSeenAction } from "@/server/actions/todo";
import { Icon } from "../ui/icon";
import { Presence } from "../ui/motion";
import { DarkOverlay } from "./dark-overlay";

export interface AchievementRow {
  id: string;
  icon: IconName;
  title: string;
  meta: string;
  value: string;
}

const CONFETTI = ["#023E7D", "#5FA0FF", "#9CC3FF", "#F5B73B", "#3E9B52", "#FFFFFF"];
const PIECES = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37 + 8) % 96}%`,
  w: i % 3 ? 6 : 9,
  h: i % 3 ? 10 : 5,
  r: i % 4 ? 2 : 999,
  c: CONFETTI[i % CONFETTI.length]!,
  anim: `pmaC${i % 3} ${1.5 + (i % 5) * 0.15}s cubic-bezier(.22,1,.36,1) ${(i % 7) * 0.05}s forwards`,
}));

/** Celebration pop-up (prototype "achievements" modal) with a confetti burst. */
export function AchievementsModal({ headline, sub, rows, onClose }: { headline: string; sub: string; rows: AchievementRow[]; onClose: () => void }) {
  const [confetti, setConfetti] = useState(false);
  useEffect(() => {
    const on = setTimeout(() => setConfetti(true), 350);
    const off = setTimeout(() => setConfetti(false), 2750);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, []);
  return (
    <DarkOverlay onClose={onClose} label="Achievements" animate>
      <div
        className="bg-blue-chip pm-scroll relative flex max-h-[calc(100%-32px)] w-full max-w-[460px] flex-col items-center gap-3 overflow-hidden overflow-y-auto rounded-[32px] px-5 pb-[18px] pt-[22px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_40px_100px_rgba(0,0,0,.4)]"
        style={{ animation: "pmcCard .7s cubic-bezier(.16,1,.3,1) both" }}
      >
        <span className="pointer-events-none absolute inset-y-0 left-0 w-[30%] bg-[linear-gradient(100deg,transparent,rgba(255,255,255,.12),transparent)]" style={{ animation: "pmaShine 3.4s cubic-bezier(.45,0,.2,1) .6s infinite" }} />
        <button type="button" onClick={onClose} title="Close" aria-label="Close" className="hit-44 absolute right-3.5 top-3.5 z-[3] h-[34px] w-[34px] rounded-pill border-0 bg-white/16 text-base text-white hover:bg-white/28">
          ×
        </button>
        <span className="flex h-[60px] w-[60px] items-center justify-center rounded-pill bg-white/16" style={{ animation: "pmaPop .9s cubic-bezier(.16,1,.3,1) .15s both, pmaGlow 2.4s ease-in-out 1s infinite" }}>
          <Icon name="trophy" size={30} strokeWidth={1.4} color="#fff" />
        </span>
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-xs uppercase tracking-[.14em] opacity-85">Congratulations</span>
          <span className="text-[26px] font-light leading-8 tracking-[-.01em] [text-wrap:balance]">{headline}</span>
          <span className="text-[13px] opacity-88">{sub}</span>
        </div>
        <ul className="m-0 flex w-full list-none flex-col gap-1.5 p-0">
          {rows.map((a, i) => {
            const delay = `${i * 90 + 300}ms`;
            return (
              <li key={a.id} className="flex min-h-12 items-center gap-2.5 rounded-row bg-white/10 px-3 py-1.5" style={{ animation: `pmaIn .6s cubic-bezier(.16,1,.3,1) ${delay} both` }}>
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-pill bg-white/18" style={{ animation: `pmaPop .7s cubic-bezier(.16,1,.3,1) ${delay} both` }}>
                  <Icon name={a.icon} size={13} strokeWidth={1.6} color="#fff" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="text-[13px] leading-[17px] [text-wrap:pretty]">{a.title}</span>
                  <span className="text-[11px] opacity-85">{a.meta}</span>
                </span>
                <span className="whitespace-nowrap text-[13px] font-medium">{a.value}</span>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={onClose} className="h-11 w-full rounded-pill border-0 bg-white text-sm font-medium text-navy-950 hover:bg-[#DCE7F7] active:scale-[.97]">
          Keep going
        </button>
        {confetti && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {PIECES.map((p, i) => (
              <span key={i} className="absolute -top-2 opacity-0" style={{ left: p.left, width: p.w, height: p.h, borderRadius: p.r, background: p.c, animation: p.anim }} />
            ))}
          </div>
        )}
      </div>
    </DarkOverlay>
  );
}

/** Hero button: "Achievements · N this month · tap to view". */
export function AchievementsButton({ rows, headline, sub }: { rows: AchievementRow[]; headline: string; sub: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void markAchievementsSeenAction({});
        }}
        className="bg-blue-chip relative flex min-w-[220px] flex-none items-center gap-3 overflow-hidden rounded-[18px] border-0 px-3.5 py-2 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_10px_24px_rgba(0,18,51,.22)] transition-transform duration-200 ease-spring hover:-translate-y-0.5 active:scale-[.98]"
      >
        <span className="pointer-events-none absolute inset-y-0 left-0 w-[30%] bg-[linear-gradient(100deg,transparent,rgba(255,255,255,.14),transparent)]" style={{ animation: "pmaShine 3.4s cubic-bezier(.45,0,.2,1) 1s infinite" }} />
        <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-pill bg-white/16" style={{ animation: "pmaGlow 2.4s ease-in-out infinite" }}>
          <Icon name="trophy" size={18} color="#fff" />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-[13px] font-medium">Achievements</span>
          <span className="text-[11px] opacity-88">{rows.length} this month · tap to view</span>
        </span>
        <span className="text-sm" aria-hidden="true">
          ↗
        </span>
      </button>
      <Presence value={open}>{() => <AchievementsModal headline={headline} sub={sub} rows={rows} onClose={() => setOpen(false)} />}</Presence>
    </>
  );
}

export function achievementValue(paise: number | null): string {
  return paise === null ? "" : formatCompactINR(paise);
}
