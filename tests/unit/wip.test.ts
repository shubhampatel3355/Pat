import { describe, expect, it } from "vitest";
import { leadInputSchema } from "@/lib/schemas/wip";
import { areaLabel, estimatedFeesPaise, monthlyRentPaise, rateLabel, rentLine } from "@/lib/wip";

describe("WIP fees = one month's rent", () => {
  it("per sq ft multiplies area by rate", () => {
    expect(monthlyRentPaise("PER_SQFT", 92_00, 12_500, null)).toBe(11_50_000_00);
    expect(estimatedFeesPaise("PER_SQFT", 92_00, 12_500, 140)).toBe(11_50_000_00);
  });
  it("per seat multiplies seats by rate and ignores area", () => {
    expect(estimatedFeesPaise("PER_SEAT", 9_500_00, 0, 60)).toBe(5_70_000_00);
  });
  it("lumpsum is the amount itself", () => {
    expect(estimatedFeesPaise("LUMPSUM", 5_00_000_00, null, null)).toBe(5_00_000_00);
  });
  it("handles fractional rates to the paisa", () => {
    expect(monthlyRentPaise("PER_SQFT", 85_50, 4_500, null)).toBe(3_84_750_00);
  });
});

describe("WIP labels (prototype formats)", () => {
  it("formats price / rent", () => {
    expect(rateLabel("PER_SQFT", 92_00)).toBe("₹ 92 / sq ft");
    expect(rateLabel("PER_SQFT", 85_50)).toBe("₹ 85.5 / sq ft");
    expect(rateLabel("PER_SEAT", 9_500_00)).toBe("₹ 9,500 / seat");
    expect(rateLabel("LUMPSUM", 1)).toBe("Lumpsum");
    expect(rentLine("PER_SQFT", 11_50_000_00)).toBe("₹ 11.5 L / month");
    expect(rentLine("LUMPSUM", 5_00_000_00)).toBe("₹ 5 L fixed");
  });
  it("formats area / seats", () => {
    expect(areaLabel("PER_SQFT", 12_500, null)).toBe("12,500 sq ft");
    expect(areaLabel("PER_SEAT", null, 60)).toBe("60 seats");
    expect(areaLabel("LUMPSUM", null, null)).toBe("—");
  });
});

describe("lead validation", () => {
  const base = {
    tenantName: "Zeta Fintech",
    landlordType: "LANDLORD" as const,
    landlordName: "Prestige Group",
    pricingBasis: "PER_SQFT" as const,
    areaSqft: 12_500,
    seats: null,
    ratePaise: 92_00,
    building: "Prestige Tech Park",
    location: "Marathahalli, ORR",
    primaryBrokerIds: ["0195f3a2-7c1e-7d4b-9a10-1b2c3d4e5f60"],
    secondaryBrokers: [{ externalName: "Ramesh (CBRE)" }],
    closureDate: "2026-11-30",
    remark: "VISITS" as const,
  };
  it("accepts a complete lead", () => expect(leadInputSchema.safeParse(base).success).toBe(true));
  it("requires area for per-sq-ft and seats for per-seat", () => {
    expect(leadInputSchema.safeParse({ ...base, areaSqft: null }).success).toBe(false);
    expect(leadInputSchema.safeParse({ ...base, pricingBasis: "PER_SEAT" }).success).toBe(false);
    expect(leadInputSchema.safeParse({ ...base, pricingBasis: "PER_SEAT", seats: 60 }).success).toBe(true);
  });
  it("needs at least one primary broker", () => expect(leadInputSchema.safeParse({ ...base, primaryBrokerIds: [] }).success).toBe(false));
  it("rejects the same person as primary and secondary", () => {
    const id = base.primaryBrokerIds[0]!;
    expect(leadInputSchema.safeParse({ ...base, secondaryBrokers: [{ userId: id }] }).success).toBe(false);
  });
  it("strips control characters and trims", () => {
    const r = leadInputSchema.parse({ ...base, tenantName: "  Zeta\u0007 Fintech  " });
    expect(r.tenantName).toBe("Zeta Fintech");
  });
});
