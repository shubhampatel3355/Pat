import { z } from "../zod";
import { PERMISSION_KEYS } from "../permissions";

export const permissionToggleSchema = z.object({
  role: z.enum(["ADMIN", "EMPLOYEE"]),
  key: z.string().refine((k) => (PERMISSION_KEYS as string[]).includes(k), "Unknown permission"),
  allowed: z.boolean(),
});

/** ₹ 10,000 Cr — far above any target; catches a mistyped extra zero or three. */
const MAX_TARGET_PAISE = 10_000_00_00_000_00;

export const targetsSchema = z.object({
  fy: z.number().int().min(2000).max(2100),
  quarter: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  entries: z
    .array(
      z.object({
        scope: z.enum(["COMPANY", "PARTNER", "USER"]),
        scopeKey: z.string().min(1).max(64),
        metric: z.enum(["REVENUE", "WIP_FEES"]),
        /** null clears the target. */
        amountPaise: z.number().int().min(0).max(MAX_TARGET_PAISE).nullable(),
      }),
    )
    .max(400),
});

export type TargetsInput = z.input<typeof targetsSchema>;
