import { describe, expect, it } from "vitest";
import { gstinCheckChar } from "@/lib/gstin";
import { dueDateFromTerms, formatDocNumber, settledStatus } from "@/lib/invoice";
import { brokerSharesProblem, invoiceInputSchema, paymentInputSchema, proformaInputSchema } from "@/lib/schemas/invoice";

describe("document numbers", () => {
  it("are per kind and financial year, four digits", () => {
    expect(formatDocNumber("INVOICE", "26-27", 1)).toBe("PM/26-27/0001");
    expect(formatDocNumber("PROFORMA", "26-27", 12)).toBe("PF/26-27/0012");
    expect(formatDocNumber("CREDIT_NOTE", "25-26", 3)).toBe("CN/25-26/0003");
  });
  it("grow past 9999 without truncating", () => expect(formatDocNumber("INVOICE", "26-27", 10000)).toBe("PM/26-27/10000"));
});

describe("due date from payment terms", () => {
  const issued = "2026-10-22";
  it.each([
    ["Net 30 days", "2026-11-21"],
    ["Net 15", "2026-11-06"],
    ["within 45 days of invoice", "2026-12-06"],
    ["Due on receipt", "2026-10-22"],
    ["Immediate", "2026-10-22"],
    ["100% advance", "2026-10-22"],
    ["50% on acceptance, balance on LOI", "2026-11-21"],
    ["Net 900 days", "2027-10-22"],
  ])("%s → %s", (terms, due) => expect(dueDateFromTerms(terms, issued)).toBe(due));
});

describe("settled status", () => {
  // ₹ 10,00,000 fees + 18% GST
  const fees = 100_000_000;
  const total = 118_000_000;
  it("starts issued", () => expect(settledStatus(total, 0, 0, 0, fees)).toBe("ISSUED"));
  it("is partially paid after a part payment", () => expect(settledStatus(total, 50_000_000, 0, 0, fees)).toBe("PARTIALLY_PAID"));
  it("is paid when payments and credit notes cover the total", () => expect(settledStatus(total, 100_000_000, 18_000_000, 15_254_238, fees)).toBe("PAID"));
  it("is credited when credit notes cover all the fees, even if something was paid", () => expect(settledStatus(total, 10_000_000, total, fees, fees)).toBe("CREDITED"));
});

describe("invoice input", () => {
  const gstin = (first14: string) => first14 + gstinCheckChar(first14);
  const base = {
    payeeName: "Zeta Fintech Pvt Ltd",
    billingAddress: "Prestige Tech Park, Marathahalli, Bengaluru 560103",
    gstin: gstin("29AABCZ1234F1Z").toLowerCase(),
    narration: "Brokerage — 12,500 sq ft at Prestige Tech Park",
    paymentTerms: "Net 30 days",
    mobile: "+91 98450 21734",
    email: "Accounts@Zeta.tech",
    feesPaise: 115_000_000,
    brokers: [
      { userId: "01a16334-418e-7061-ad0d-0a2bf1c6a0d2", sharePct: 50 },
      { externalName: "JLL (co-broker)", sharePct: 50 },
    ],
    leadId: null,
  };

  it("normalises GSTIN, mobile and email", () => {
    const r = invoiceInputSchema.parse(base);
    expect(r.gstin).toBe(gstin("29AABCZ1234F1Z"));
    expect(r.mobile).toBe("9845021734");
    expect(r.email).toBe("accounts@zeta.tech");
  });
  it("rejects a GSTIN with a wrong check character", () => {
    const good = gstin("29AABCZ1234F1Z");
    const bad = good.slice(0, 14) + (good[14] === "A" ? "B" : "A");
    expect(invoiceInputSchema.safeParse({ ...base, gstin: bad }).success).toBe(false);
  });
  it("needs broker shares to total 100%", () => {
    expect(brokerSharesProblem([{ sharePct: 60 }, { sharePct: 30 }])).toBe("Broker shares must add up to 100% (now 90%)");
    expect(brokerSharesProblem([])).toBeNull();
    expect(invoiceInputSchema.safeParse({ ...base, brokers: [{ ...base.brokers[0], sharePct: 60 }, base.brokers[1]] }).success).toBe(false);
  });
  it("rejects the same broker twice on invoices and proformas", () => {
    const twice = [
      { userId: "01a16334-418e-7061-ad0d-0a2bf1c6a0d2", sharePct: 50 },
      { userId: "01a16334-418e-7061-ad0d-0a2bf1c6a0d2", sharePct: 50 },
    ];
    expect(invoiceInputSchema.safeParse({ ...base, brokers: twice }).success).toBe(false);
    expect(proformaInputSchema.safeParse({ ...base, brokers: twice, validityDays: 15 }).success).toBe(false);
  });
  it("only allows 7, 15 or 30 day proformas", () => {
    expect(proformaInputSchema.safeParse({ ...base, validityDays: 15 }).success).toBe(true);
    expect(proformaInputSchema.safeParse({ ...base, validityDays: 20 }).success).toBe(false);
  });
});

describe("payment input", () => {
  const ok = { invoiceId: "01a16334-418e-7061-ad0d-0a2bf1c6a0d2", amountPaise: 135_700_000, receivedOn: "2026-10-22", mode: "NEFT", reference: "HDFCN52026102200001" };
  it("accepts a payment", () => expect(paymentInputSchema.safeParse(ok).success).toBe(true));
  it("rejects an impossible date", () => expect(paymentInputSchema.safeParse({ ...ok, receivedOn: "2026-13-01" }).success).toBe(false));
  it("rejects a zero amount", () => expect(paymentInputSchema.safeParse({ ...ok, amountPaise: 0 }).success).toBe(false));
});
