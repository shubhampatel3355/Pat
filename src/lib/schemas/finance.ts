import { z } from "../zod";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../finance";
import { isoDate, requiredText, text } from "./common";

/** ₹ 1,000 Cr in paise — far above any single entry; catches a mistyped extra zero or three. */
const MAX_ENTRY_PAISE = 1_000_000_000_000;

export const ledgerEntryInputSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]),
    amountPaise: z.number().int().positive("Enter an amount").max(MAX_ENTRY_PAISE, "That amount looks too large"),
    party: text(120),
    description: text(200).pipe(z.string().min(3, "Add a short description")),
    category: z.string(),
    mode: z.enum(["NEFT", "RTGS", "IMPS", "UPI", "CHEQUE", "CARD", "CASH", "OTHER"]),
    entryDate: isoDate,
  })
  .superRefine((v, ctx) => {
    const allowed: readonly string[] = v.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!allowed.includes(v.category)) ctx.addIssue({ code: "custom", path: ["category"], message: "Pick a category" });
  });

export const voidLedgerEntrySchema = z.object({
  id: z.uuid(),
  reason: requiredText(200, "Say why this entry is being voided"),
});

/** Query of the finance export route: ?fy=2026&format=xlsx */
export const financeExportQuerySchema = z.object({
  fy: z.coerce.number().int().min(2000).max(2100),
  format: z.enum(["xlsx", "pdf"]),
});
