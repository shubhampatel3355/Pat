/**
 * Calendar helpers. Business dates are interpreted in Asia/Kolkata; DATE columns are exchanged as
 * ISO strings ("2026-10-28"). The financial year runs April → March.
 */

const TIME_ZONE = "Asia/Kolkata";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const isoFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/**
 * Default pick-up for a new cab booking (IST): today at 10:00, or the next half hour once 10:00 has passed;
 * tomorrow at 10:00 late at night.
 */
export function defaultPickupSlot(now: Date = new Date()): { date: string; time: string } {
  const today = isoDateIST(now);
  const [h, m] = timeIST(now).split(":").map(Number) as [number, number];
  const minutes = h * 60 + m;
  if (minutes < 10 * 60) return { date: today, time: "10:00" };
  const next = Math.ceil((minutes + 1) / 30) * 30;
  if (next > 23 * 60 + 30) return { date: addDaysIso(today, 1), time: "10:00" };
  return { date: today, time: `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}` };
}

/** "YYYY-MM-DD" for an instant, in IST. */
export function isoDateIST(at: Date = new Date()): string {
  return isoFormatter.format(at);
}

/** Hour of day (0-23) in IST. */
export function hourIST(at: Date = new Date()): number {
  return Number(hourFormatter.format(at).slice(0, 2));
}

/** "HH:mm" in IST. */
export function timeIST(at: Date): string {
  return hourFormatter.format(at);
}

/** A DATE column (UTC midnight) → "YYYY-MM-DD". */
export function dateToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → Date at UTC midnight (what Prisma writes to a DATE column). */
export function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Instant for a wall-clock time in IST: ("2026-10-28", "14:30") → Date. */
export function istToInstant(iso: string, hhmm = "00:00"): Date {
  return new Date(`${iso}T${hhmm}:00.000+05:30`);
}

/** Same calendar day a year earlier (29 Feb → 28 Feb), for year-on-year windows. */
export function sameDayLastYear(iso: string): string {
  const year = Number(iso.slice(0, 4)) - 1;
  const monthDay = iso.slice(5);
  return `${year}-${monthDay === "02-29" ? "02-28" : monthDay}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return dateToIso(d);
}

/** "28 Oct 2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "28 Oct" */
export function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "Tuesday, 6 Oct 2026" */
export function formatLongDate(iso: string): string {
  const d = isoToDate(iso);
  return `${DAYS[d.getUTCDay()]}, ${formatDate(iso)}`;
}

/** "14:30" → "2:30 pm" */
export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}

/** "8 Oct, 9:12 am" in IST for an instant. */
export function formatDateTimeShort(at: Date): string {
  return `${formatDayMonth(isoDateIST(at))}, ${formatTime12(timeIST(at))}`;
}

/** "8 Oct 2026, 9:12 am" in IST for an instant (report and export stamps). */
export function formatDateTime(at: Date): string {
  return `${formatDate(isoDateIST(at))}, ${formatTime12(timeIST(at))}`;
}

export function monthLabel(month: number): string {
  return MONTHS[month - 1];
}

// ── Financial year ────────────────────────────────────────────────────────────

export interface FinancialYear {
  /** Calendar year in which the FY starts (FY 2026–27 → 2026). */
  startYear: number;
  /** "26-27" — used in document numbers (PM/26-27/0001). */
  short: string;
  /** "FY 2026–27" — display. */
  label: string;
  /** "FY2026-27" — storage key for targets. */
  key: string;
  start: string;
  end: string;
}

export function financialYear(startYear: number): FinancialYear {
  const next = startYear + 1;
  return {
    startYear,
    short: `${String(startYear).slice(-2)}-${String(next).slice(-2)}`,
    label: `FY ${startYear}–${String(next).slice(-2)}`,
    key: `FY${startYear}-${String(next).slice(-2)}`,
    start: `${startYear}-04-01`,
    end: `${next}-03-31`,
  };
}

export function fyOfIso(iso: string): FinancialYear {
  const [y, m] = iso.split("-").map(Number);
  return financialYear(m >= 4 ? y : y - 1);
}

export function currentFy(at: Date = new Date()): FinancialYear {
  return fyOfIso(isoDateIST(at));
}

/** Indian FY quarter: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar. */
export function fyQuarterOfIso(iso: string): { fy: FinancialYear; q: 1 | 2 | 3 | 4; key: string; label: string; start: string; end: string } {
  const fy = fyOfIso(iso);
  const m = Number(iso.slice(5, 7));
  const q = (m >= 4 ? Math.floor((m - 4) / 3) + 1 : 4) as 1 | 2 | 3 | 4;
  return { fy, q, ...quarterBounds(fy, q) };
}

export function quarterBounds(fy: FinancialYear, q: 1 | 2 | 3 | 4) {
  const ranges: Record<number, [string, string, string]> = {
    1: [`${fy.startYear}-04-01`, `${fy.startYear}-06-30`, "Apr – Jun"],
    2: [`${fy.startYear}-07-01`, `${fy.startYear}-09-30`, "Jul – Sep"],
    3: [`${fy.startYear}-10-01`, `${fy.startYear}-12-31`, "Oct – Dec"],
    4: [`${fy.startYear + 1}-01-01`, `${fy.startYear + 1}-03-31`, "Jan – Mar"],
  };
  const [start, end, months] = ranges[q];
  return { key: `${fy.key}-Q${q}`, label: `Q${q} FY ${fy.short.replace("-", "–")}`, months, start, end };
}

/** Months of a financial year as "YYYY-MM", April first. */
export function fyMonths(fy: FinancialYear): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((3 + i) % 12) + 1;
    const y = m >= 4 ? fy.startYear : fy.startYear + 1;
    return `${y}-${String(m).padStart(2, "0")}`;
  });
}

/** "Apr – Oct 2026" style range label from FY start to the given date. */
export function fyToDateLabel(fy: FinancialYear, uptoIso: string): string {
  const [y, m] = uptoIso.split("-").map(Number);
  return `Apr – ${MONTHS[m - 1]} ${y}`.replace(`Apr – Apr ${fy.startYear}`, `Apr ${fy.startYear}`);
}

/** Relative day label used across agenda/to-do lists. */
export function relativeDayLabel(iso: string, todayIso: string): string {
  if (iso === todayIso) return "Today";
  if (iso === addDaysIso(todayIso, 1)) return "Tomorrow";
  if (iso === addDaysIso(todayIso, -1)) return "Yesterday";
  return formatDayMonth(iso);
}
