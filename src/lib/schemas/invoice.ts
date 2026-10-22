import { z } from "zod";
import { checkGstin, gstinErrorMessage, normaliseGstin } from "../gstin";
import { email, indianMobile, isoDate, requiredText, text } from "./common";

export const brokerShareSchema = z.union([
  z.object({ userId: z.uuid(), sharePct: z.number().int().min(1).max(100) }),
  z.object({ externalName: requiredText(80, "Type the broker's full name"), sharePct: z.number().int().min(1).max(100) }),
]);

export const gstinSchema = z
  .string()
  .transform(normaliseGstin)
  .superRefine((v, ctx) => {
    const r = checkGstin(v);
    if (!r.ok) ctx.addIssue({ code: "custom", message: gstinErrorMessage(r.reason) });
  });

/** Brokers are optional, but when listed their shares must total exactly 100%. */
export function brokerSharesProblem(brokers: { sharePct: number }[]): string | null {
  if (!brokers.length) return null;
  const total = brokers.reduce((a, b) => a + b.sharePct, 0);
  return total === 100 ? null : `Broker shares must add up to 100% (now ${total}%)`;
}

const documentFields = {
  payeeName: requiredText(160, "Enter the payee name"),
  billingAddress: text(400).pipe(z.string().min(8, "Enter the bill-to address")),
  gstin: gstinSchema,
  narration: text(400),
  paymentTerms: requiredText(160, "Enter the payment terms"),
  mobile: indianMobile,
  email,
  feesPaise: z.number().int().positive("Enter the total fees").max(100_000_000_000_00),
  brokers: z.array(brokerShareSchema).max(10),
  leadId: z.uuid().nullable(),
};

/** Shares total 100% and nobody is listed twice (a proforma's split carries over to its invoice). */
function refineBrokers(v: { brokers: z.infer<typeof brokerShareSchema>[] }, ctx: z.RefinementCtx) {
  const problem = brokerSharesProblem(v.brokers);
  if (problem) ctx.addIssue({ code: "custom", path: ["brokers"], message: problem });
  const users = v.brokers.flatMap((b) => ("userId" in b ? [b.userId] : []));
  if (new Set(users).size !== users.length) ctx.addIssue({ code: "custom", path: ["brokers"], message: "A broker is listed twice" });
}

export const invoiceInputSchema = z.object(documentFields).superRefine(refineBrokers);

export const proformaInputSchema = z.object({ ...documentFields, validityDays: z.union([z.literal(7), z.literal(15), z.literal(30)]) }).superRefine(refineBrokers);

export const paymentInputSchema = z.object({
  invoiceId: z.uuid(),
  amountPaise: z.number().int().positive("Enter the amount received"),
  receivedOn: isoDate,
  mode: z.enum(["NEFT", "RTGS", "IMPS", "UPI", "CHEQUE", "CARD", "CASH", "OTHER"]),
  reference: text(80),
});

export const creditNoteInputSchema = z.object({
  invoiceId: z.uuid(),
  feesPaise: z.number().int().positive("Enter the amount to credit"),
  reason: requiredText(300, "Give a reason for the credit note"),
});

export type InvoiceInput = z.input<typeof invoiceInputSchema>;
export type ProformaInput = z.input<typeof proformaInputSchema>;
