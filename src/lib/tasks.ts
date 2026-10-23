import { addDaysIso, formatDayMonth, formatTime12, isoDateIST, istToInstant, timeIST } from "./dates";

/** Default time for tasks given only a day (prototype: "Today 6:00 pm"). */
export const DEFAULT_TASK_TIME = "18:00";

export type DueTone = "overdue" | "today" | "later" | "none";

/** Pill colours (prototype: overdue = solid blue, today = blue tint, later = grey chip). */
export const DUE_TONE_STYLE: Record<DueTone, { bg: string; fg: string }> = {
  overdue: { bg: "#023E7D", fg: "#FFFFFF" },
  today: { bg: "rgba(2,62,125,.14)", fg: "#001233" },
  later: { bg: "#DCDCDC", fg: "#55555A" },
  none: { bg: "#DCDCDC", fg: "#55555A" },
};

/** Instant → "Today 6:00 pm", "Tomorrow 11:00 am", "Yesterday 9:30 am" or "24 Oct, 10:00 am" (IST). */
export function instantLabel(at: string, today: string): string {
  const d = new Date(at);
  const day = isoDateIST(d);
  const time = formatTime12(timeIST(d));
  if (day === today) return `Today ${time}`;
  if (day === addDaysIso(today, 1)) return `Tomorrow ${time}`;
  if (day === addDaysIso(today, -1)) return `Yesterday ${time}`;
  return `${formatDayMonth(day)}, ${time}`;
}

export function dueTone(at: string | null, now: string, today: string, done = false): DueTone {
  if (!at || done) return "none";
  if (Date.parse(at) < Date.parse(now)) return "overdue";
  return isoDateIST(new Date(at)) === today ? "today" : "later";
}

export type FollowUpTab = "TODAY" | "OVERDUE" | "UPCOMING";

/** Overdue once the time has passed; Today for the rest of today; Upcoming after that. */
export function followUpTab(at: string, now: string, today: string): FollowUpTab {
  if (Date.parse(at) < Date.parse(now)) return "OVERDUE";
  return isoDateIST(new Date(at)) === today ? "TODAY" : "UPCOMING";
}

/** "Move to" choices: later today (until 5 pm), tomorrow 11 am, the day after at 10 am. */
export function rescheduleOptions(now: string, today: string): { label: string; date: string; time: string }[] {
  const options: { label: string; date: string; time: string }[] = [];
  if (Date.parse(now) < istToInstant(today, "17:00").getTime()) options.push({ label: "Today 6:00 pm", date: today, time: "18:00" });
  const tomorrow = addDaysIso(today, 1);
  const dayAfter = addDaysIso(today, 2);
  options.push({ label: "Tomorrow 11:00 am", date: tomorrow, time: "11:00" });
  options.push({ label: `${formatDayMonth(dayAfter)}, 10:00 am`, date: dayAfter, time: "10:00" });
  return options;
}

/** Split an instant into the IST date and time used by forms. */
export function splitInstant(at: string | null): { date: string; time: string } | null {
  if (!at) return null;
  const d = new Date(at);
  return { date: isoDateIST(d), time: timeIST(d) };
}
