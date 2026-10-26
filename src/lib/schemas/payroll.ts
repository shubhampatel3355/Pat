import { z } from "../zod";
import { isoDate, text } from "./common";

/** ₹ 1 Cr a month — far above any line on a payslip; catches a mistyped extra zero or three. */
const MAX_LINE_PAISE = 1_00_00_000_00;
const amount = z.number().int().min(0, "Amounts can't be negative").max(MAX_LINE_PAISE, "That amount looks too large");

export const startRunSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month"),
  payDate: isoDate,
});

export const payslipEditSchema = z.object({
  id: z.uuid(),
  commissionPaise: amount,
  incentivePaise: amount,
  otherPaise: amount,
  /** null = use the TDS estimate. */
  tdsPaise: amount.nullable(),
  onHold: z.boolean(),
  note: text(200),
});

export const runIdSchema = z.object({ id: z.uuid() });

export type PayslipEditInput = z.input<typeof payslipEditSchema>;
