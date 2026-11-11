/**
 * Formatting comes from the web app's own helpers (../src/lib), so amounts, dates and labels read exactly the
 * same in both apps: ₹ 12,36,640 · ₹ 1.5 Cr · 28 Oct 2026 · 2:30 pm · FY 2026–27.
 */
export { formatAmountInput, formatCompactINR, formatINR, paiseToInput, parseRupeesToPaise } from "@shared/money";
export { addDaysIso, formatDate, formatDayMonth, formatLongDate, formatTime12, isoDateIST, relativeDayLabel, timeIST } from "@shared/dates";
export { ROLE_LABELS } from "@shared/permissions";

import { formatDayMonth, formatTime12, isoDateIST, timeIST } from "@shared/dates";

/** "Just now", "5 min ago", "3 h ago", "Yesterday, 9:12 am", "8 Oct, 9:12 am" (IST). */
export function ago(at: string, now = Date.now()): string {
  const t = Date.parse(at);
  const mins = Math.floor((now - t) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 6 * 60) return `${Math.floor(mins / 60)} h ago`;
  const day = isoDateIST(new Date(t));
  const today = isoDateIST(new Date(now));
  const time = formatTime12(timeIST(new Date(t)));
  if (day === today) return `Today, ${time}`;
  const yesterday = isoDateIST(new Date(now - 86_400_000));
  if (day === yesterday) return `Yesterday, ${time}`;
  return `${formatDayMonth(day)}, ${time}`;
}

export function percent(part: number, whole: number | null | undefined): number {
  return whole && whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
