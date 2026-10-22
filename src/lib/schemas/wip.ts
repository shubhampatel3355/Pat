import { z } from "zod";
import { isoDate, requiredText, text } from "./common";

export const WIP_REMARK_VALUES = ["VISITS", "MEETINGS", "FOLLOW_UP_MEETINGS", "NEGOTIATIONS", "ON_HOLD", "LOST", "INVOICE_RAISED", "PAYMENT_COLLECTED"] as const;

export const secondaryBrokerSchema = z.union([
  z.object({ userId: z.uuid() }),
  z.object({ externalName: requiredText(80, "Type the broker's full name") }),
]);

export const leadInputSchema = z
  .object({
    tenantName: requiredText(120, "Enter the tenant name"),
    landlordType: z.enum(["LANDLORD", "OPERATOR"]),
    landlordName: text(120),
    pricingBasis: z.enum(["PER_SQFT", "PER_SEAT", "LUMPSUM"]),
    areaSqft: z.number().int().positive().max(50_000_000).nullable(),
    seats: z.number().int().positive().max(100_000).nullable(),
    ratePaise: z.number().int().positive("Enter the rent").max(10_000_000_000_00),
    building: text(120),
    location: requiredText(120, "Enter the location"),
    primaryBrokerIds: z.array(z.uuid()).min(1, "Select a primary broker").max(5),
    secondaryBrokers: z.array(secondaryBrokerSchema).max(8),
    closureDate: isoDate,
    remark: z.enum(WIP_REMARK_VALUES),
  })
  .superRefine((v, ctx) => {
    if (v.pricingBasis === "PER_SQFT" && !v.areaSqft) ctx.addIssue({ code: "custom", path: ["areaSqft"], message: "Enter the area" });
    if (v.pricingBasis === "PER_SEAT" && !v.seats) ctx.addIssue({ code: "custom", path: ["seats"], message: "Enter the number of seats" });
    if (new Set(v.primaryBrokerIds).size !== v.primaryBrokerIds.length) ctx.addIssue({ code: "custom", path: ["primaryBrokerIds"], message: "A broker is listed twice" });
    const secondaryUsers = v.secondaryBrokers.flatMap((b) => ("userId" in b ? [b.userId] : []));
    if (secondaryUsers.some((id) => v.primaryBrokerIds.includes(id)) || new Set(secondaryUsers).size !== secondaryUsers.length) {
      ctx.addIssue({ code: "custom", path: ["secondaryBrokers"], message: "A broker is listed twice" });
    }
  });

export type LeadInput = z.input<typeof leadInputSchema>;
