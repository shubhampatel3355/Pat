import { z } from "zod";

/** "YYYY-MM-DD" calendar date. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Pick a valid date");

/** "HH:mm" 24-hour time. */
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time");

/** Trimmed single-line text without control characters. */
export const text = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim())
    .pipe(z.string().max(max, `Keep it under ${max} characters`));

export const requiredText = (max: number, message: string) => text(max).pipe(z.string().min(2, message));

/** Indian mobile number: 10 digits after stripping +91 / spaces. */
export const indianMobile = z
  .string()
  .transform((s) => s.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"));

export const email = z.string().trim().toLowerCase().email("Enter a valid email").max(200);

/** Format a 10-digit mobile as "98450 21734". */
export function formatMobile(digits: string): string {
  return digits.replace(/^(\d{5})(\d{5})$/, "$1 $2");
}
