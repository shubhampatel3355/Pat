"use server";

import { refresh } from "next/cache";
import { ok } from "@/lib/action-result";
import { formatDate, isoDateIST, isoToDate } from "@/lib/dates";
import { formatINR, toPaise } from "@/lib/money";
import { ledgerEntryInputSchema, voidLedgerEntrySchema } from "@/lib/schemas/finance";
import { writeAudit } from "../audit";
import { db } from "../db";
import { can } from "../policy";
import { defineAction, UserError } from "./define";

const kindOf = (type: "INCOME" | "EXPENSE") => (type === "INCOME" ? "income" : "expense");

export const addLedgerEntryAction = defineAction({
  schema: ledgerEntryInputSchema,
  authorize: (user) => can(user, "record", { type: "finance" }),
  handler: async ({ user, input, meta }) => {
    if (input.entryDate > isoDateIST()) throw new UserError("The date can't be in the future", { entryDate: "In the future" });
    const entry = await db.$transaction(async (tx) => {
      const created = await tx.ledgerEntry.create({
        data: {
          type: input.type,
          category: input.category,
          description: input.description,
          party: input.party || null,
          mode: input.mode,
          amountPaise: BigInt(input.amountPaise),
          entryDate: isoToDate(input.entryDate),
          createdById: user.id,
        },
      });
      await writeAudit(tx, {
        actor: user,
        module: "Finance",
        action: "create",
        text: `${user.name} posted ${kindOf(input.type)} of ${formatINR(input.amountPaise)} — ${input.description} (${formatDate(input.entryDate)})`,
        entityType: "LedgerEntry",
        entityId: created.id,
        after: { ...input },
        meta,
        visibility: "PRIVATE",
      });
      return created;
    });
    refresh();
    return ok(`${input.type === "INCOME" ? "Income" : "Expense"} of ${formatINR(input.amountPaise)} posted`, { id: entry.id });
  },
});

export const voidLedgerEntryAction = defineAction({
  schema: voidLedgerEntrySchema,
  authorize: (user) => can(user, "record", { type: "finance" }),
  handler: async ({ user, input, meta }) => {
    const entry = await db.ledgerEntry.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!entry) throw new UserError("That entry has already been voided");
    if (entry.paymentId) throw new UserError("This receipt comes from an invoice payment, so it can't be voided here");
    if (entry.payrollRunId) throw new UserError("This entry comes from a payroll run, so it can't be voided here");
    await db.$transaction(async (tx) => {
      const voided = await tx.ledgerEntry.updateMany({ where: { id: entry.id, deletedAt: null }, data: { deletedAt: new Date() } });
      if (!voided.count) throw new UserError("That entry has already been voided");
      await writeAudit(tx, {
        actor: user,
        module: "Finance",
        action: "delete",
        text: `${user.name} voided the ${kindOf(entry.type)} of ${formatINR(toPaise(entry.amountPaise))} — ${entry.description}. Reason: ${input.reason}`,
        entityType: "LedgerEntry",
        entityId: entry.id,
        before: entry,
        after: { reason: input.reason },
        meta,
        visibility: "PRIVATE",
      });
    });
    refresh();
    return ok("Entry voided");
  },
});
