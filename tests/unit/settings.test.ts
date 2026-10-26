import { describe, expect, it } from "vitest";
import { PERMISSION_DEFS } from "@/lib/permissions";
import { paymentReverseSchema } from "@/lib/schemas/invoice";
import { permissionToggleSchema, targetsSchema } from "@/lib/schemas/settings";

const ID = "01a16334-418e-7061-ad0d-0a2bf1c6a0d2";

describe("role permission toggles", () => {
  it("accepts a known permission for admins and employees", () => {
    expect(permissionToggleSchema.safeParse({ role: "EMPLOYEE", key: PERMISSION_DEFS[0]!.key, allowed: true }).success).toBe(true);
    expect(permissionToggleSchema.safeParse({ role: "ADMIN", key: PERMISSION_DEFS[0]!.key, allowed: false }).success).toBe(true);
  });
  it("never edits owners, and rejects unknown keys", () => {
    expect(permissionToggleSchema.safeParse({ role: "OWNER", key: PERMISSION_DEFS[0]!.key, allowed: false }).success).toBe(false);
    expect(permissionToggleSchema.safeParse({ role: "EMPLOYEE", key: "everything.delete", allowed: true }).success).toBe(false);
  });
  it("every permission has a default for both editable roles", () => {
    for (const def of PERMISSION_DEFS) {
      expect(typeof def.defaults.ADMIN).toBe("boolean");
      expect(typeof def.defaults.EMPLOYEE).toBe("boolean");
    }
  });
});

describe("targets", () => {
  const entry = { scope: "USER" as const, scopeKey: ID, metric: "REVENUE" as const, amountPaise: 48_00_000_00 };
  it("accepts amounts and cleared targets", () => {
    expect(targetsSchema.safeParse({ fy: 2026, quarter: 3, entries: [entry, { ...entry, metric: "WIP_FEES", amountPaise: null }] }).success).toBe(true);
  });
  it("rejects negative, fractional and absurd amounts", () => {
    for (const amountPaise of [-1, 10.5, 10_001_00_00_000_00]) {
      expect(targetsSchema.safeParse({ fy: 2026, quarter: 3, entries: [{ ...entry, amountPaise }] }).success).toBe(false);
    }
  });
  it("rejects a quarter outside 1–4", () => expect(targetsSchema.safeParse({ fy: 2026, quarter: 5, entries: [] }).success).toBe(false));
});

describe("payment reversal", () => {
  it("needs a reason", () => {
    expect(paymentReverseSchema.safeParse({ paymentId: ID, reason: "" }).success).toBe(false);
    expect(paymentReverseSchema.safeParse({ paymentId: ID, reason: "Cheque bounced" }).success).toBe(true);
  });
});
