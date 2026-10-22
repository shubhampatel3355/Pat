import { z } from "zod";
import { email, indianMobile, isoDate, requiredText, text } from "./common";

export const memberInputSchema = z.object({
  name: requiredText(80, "Enter the full name"),
  phone: indianMobile,
  email,
  title: text(80),
  role: z.enum(["OWNER", "ADMIN", "EMPLOYEE"]),
  partnerId: z.uuid().nullable(),
  dateOfJoining: isoDate.nullable(),
  /** Annual CTC in paise; null leaves it unset (or unchanged for people who can't see payroll). */
  ctcAnnualPaise: z.number().int().nonnegative().max(100_000_000_000_00).nullable(),
});

export type MemberInput = z.input<typeof memberInputSchema>;
