/**
 * Money is stored and passed around as integer paise (safe JS integers up to ~₹ 90 lakh crore).
 * Display uses Indian digit grouping (₹ 12,36,640) or compact units on cards (₹ 20 L, ₹ 1.5 Cr).
 */

export const PAISE_PER_RUPEE = 100;
const LAKH = 100_000;
const CRORE = 10_000_000;

/** Group an integer string the Indian way: 1236640 → "12,36,640". */
export function groupIndian(digits: string): string {
  const negative = digits.startsWith("-");
  const d = negative ? digits.slice(1) : digits;
  if (d.length <= 3) return (negative ? "-" : "") + d;
  const last3 = d.slice(-3);
  const rest = d.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (negative ? "-" : "") + `${rest},${last3}`;
}

/** ₹ 12,36,640 — rounded to whole rupees unless `paiseDigits` is requested. */
export function formatINR(paise: number, opts: { paiseDigits?: boolean; symbol?: boolean } = {}): string {
  const { paiseDigits = false, symbol = true } = opts;
  const negative = paise < 0;
  const abs = Math.abs(paise);
  let text: string;
  if (paiseDigits) {
    const rupees = Math.floor(abs / PAISE_PER_RUPEE);
    const p = String(abs % PAISE_PER_RUPEE).padStart(2, "0");
    text = `${groupIndian(String(rupees))}.${p}`;
  } else {
    text = groupIndian(String(Math.round(abs / PAISE_PER_RUPEE)));
  }
  return `${negative ? "−" : ""}${symbol ? "₹ " : ""}${text}`;
}

function trimDecimals(value: number, digits: number): string {
  return String(Number(value.toFixed(digits)));
}

/**
 * Compact card format: ₹ 1.5 Cr, ₹ 20 L, ₹ 42 K, ₹ 950.
 * `digits` caps decimals (trailing zeros trimmed), matching the prototype's formatter.
 */
export function formatCompactINR(paise: number, digits = 2): string {
  const negative = paise < 0;
  const rupees = Math.abs(paise) / PAISE_PER_RUPEE;
  let text: string;
  if (rupees >= CRORE) text = `${trimDecimals(rupees / CRORE, digits)} Cr`;
  else if (rupees >= LAKH) text = `${trimDecimals(rupees / LAKH, digits)} L`;
  else if (rupees >= 1000) text = `${trimDecimals(rupees / 1000, digits)} K`;
  else text = String(Math.round(rupees));
  return `${negative ? "−" : ""}₹ ${text}`;
}

/**
 * Parse a rupee amount typed by a person ("11,50,000", "₹ 92.50", "1150000") into paise.
 * Returns null for empty/invalid input. At most two decimal places.
 */
export function parseRupeesToPaise(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * PAISE_PER_RUPEE) : null;
  const cleaned = input.replace(/[₹,\s]/g, "").replace(/^Rs\.?/i, "");
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const paise = Number(whole) * PAISE_PER_RUPEE + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
}

/** Rupees with Indian grouping for an input field value (no symbol, no paise when whole). */
export function paiseToInput(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "";
  const rupees = Math.floor(paise / PAISE_PER_RUPEE);
  const p = paise % PAISE_PER_RUPEE;
  return p ? `${groupIndian(String(rupees))}.${String(p).padStart(2, "0")}` : groupIndian(String(rupees));
}

/** Convert a Prisma BigInt column to a safe JS number of paise. */
export function toPaise(value: bigint | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(n)) throw new RangeError(`Amount out of safe range: ${String(value)}`);
  return n;
}

/** Percentage share of an amount, rounded to the nearest paisa. */
export function sharePaise(amountPaise: number, pct: number): number {
  return Math.round((amountPaise * pct) / 100);
}
