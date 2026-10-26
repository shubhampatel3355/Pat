import { describe, expect, it } from "vitest";
import { dealShare, incentivePaise, incentiveStatus } from "@/lib/incentive";

const NEHA = "neha";
const KARTHIK = "karthik";
const L = 100_000_00; // ₹ 1 lakh in paise

describe("incentive status by WIP stage", () => {
  it.each([
    ["INVOICE_RAISED", "EARNED"],
    ["PAYMENT_COLLECTED", "EARNED"],
    ["NEGOTIATIONS", "EXPECTED"],
    ["VISITS", "EXPECTED"],
    ["LOST", "NO_PAYOUT"],
    ["ON_HOLD", "NO_PAYOUT"],
  ] as const)("%s → %s", (remark, status) => expect(incentiveStatus(remark)).toBe(status));
});

describe("incentive amount", () => {
  it("is 20% of the share, halved while expected (prototype: Zeta Fintech ₹ 11.5 L, 50% → ₹ 57.5 K)", () => {
    expect(incentivePaise(11.5 * L, 50, "EXPECTED")).toBe(57_500_00);
    expect(incentivePaise(11.5 * L, 50, "EARNED")).toBe(1_15_000_00);
    expect(incentivePaise(11.5 * L, 50, "NO_PAYOUT")).toBe(0);
  });
});

describe("deal share", () => {
  const brokers = [
    { userId: NEHA, sharePct: null },
    { userId: KARTHIK, sharePct: null },
  ];

  it("splits equally among the WIP row's brokers before invoicing", () => {
    expect(dealShare({ userId: NEHA, estFeePaise: 11.5 * L, leadBrokers: brokers, invoices: [] })).toEqual({ feePaise: 11.5 * L, sharePct: 50 });
  });

  it("uses a share % set on the WIP row", () => {
    const set = [{ userId: NEHA, sharePct: 70 }, { userId: KARTHIK, sharePct: 30 }];
    expect(dealShare({ userId: NEHA, estFeePaise: 10 * L, leadBrokers: set, invoices: [] }).sharePct).toBe(70);
  });

  it("counts external brokers in the equal split", () => {
    const withExternal = [...brokers, { userId: null, sharePct: null }];
    expect(dealShare({ userId: NEHA, estFeePaise: 9 * L, leadBrokers: withExternal, invoices: [] }).sharePct).toBeCloseTo(33.33, 2);
  });

  it("once invoiced, uses net invoice fees and the invoice's broker split", () => {
    const r = dealShare({ userId: NEHA, estFeePaise: 11.5 * L, leadBrokers: brokers, invoices: [{ netFeesPaise: 12 * L, split: [{ userId: NEHA, sharePct: 60 }, { userId: KARTHIK, sharePct: 40 }] }] });
    expect(r).toEqual({ feePaise: 12 * L, sharePct: 60 });
  });

  it("gives nothing when the invoice split leaves the person out", () => {
    expect(dealShare({ userId: NEHA, estFeePaise: 10 * L, leadBrokers: brokers, invoices: [{ netFeesPaise: 10 * L, split: [{ userId: KARTHIK, sharePct: 100 }] }] }).sharePct).toBe(0);
  });

  it("falls back to the WIP row's share for an invoice without a split, and weights several invoices", () => {
    const r = dealShare({
      userId: NEHA,
      estFeePaise: 0,
      leadBrokers: brokers,
      invoices: [
        { netFeesPaise: 10 * L, split: [] }, // 50% of 10 L
        { netFeesPaise: 10 * L, split: [{ userId: NEHA, sharePct: 100 }] }, // 100% of 10 L
      ],
    });
    expect(r).toEqual({ feePaise: 20 * L, sharePct: 75 });
  });
});
