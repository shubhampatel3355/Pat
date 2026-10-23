import { describe, expect, it } from "vitest";
import { amountInWords } from "@/lib/money";
import { computePayslip, daysInMonth, daysPaidFor, fixedSplit, professionalTax, statementOptions, statementPeriod, sumComponents, tdsEstimate } from "@/lib/payroll";
import { payslipEditSchema, startRunSchema } from "@/lib/schemas/payroll";

const RUPEE = 100;

describe("salary structure", () => {
  it("splits fixed pay 50 / 20 / 30 and keeps every paisa", () => {
    expect(fixedSplit(82_000 * RUPEE)).toEqual({ basic: 41_000 * RUPEE, hra: 16_400 * RUPEE, special: 24_600 * RUPEE });
    const odd = fixedSplit(33_333_33);
    expect(odd.basic + odd.hra + odd.special).toBe(33_333_33);
  });
});

describe("statutory deductions", () => {
  it("professional tax: ₹ 200 from ₹ 25,000, ₹ 300 in February, none below", () => {
    expect(professionalTax(25_000 * RUPEE, "2026-10")).toBe(200 * RUPEE);
    expect(professionalTax(25_000 * RUPEE, "2027-02")).toBe(300 * RUPEE);
    expect(professionalTax(24_999 * RUPEE, "2026-10")).toBe(0);
  });
  it("TDS estimate: 10 % of gross above ₹ 50,000", () => {
    expect(tdsEstimate(199_000 * RUPEE)).toBe(14_900 * RUPEE);
    expect(tdsEstimate(42_000 * RUPEE)).toBe(0);
  });
});

describe("computePayslip", () => {
  // The prototype's October payslip for Neha Sharma: ₹ 82,000 fixed + ₹ 92,000 commission + ₹ 25,000 incentive.
  const neha = computePayslip({ period: "2026-10", ctcAnnualPaise: 9_84_000 * RUPEE, daysPaid: 31, commission: 92_000 * RUPEE, incentive: 25_000 * RUPEE });
  it("matches the prototype's arithmetic plus PT", () => {
    expect(neha.gross).toBe(1_99_000 * RUPEE);
    expect(neha.pf).toBe(4_920 * RUPEE);
    expect(neha.tds).toBe(14_900 * RUPEE);
    expect(neha.pt).toBe(200 * RUPEE);
    expect(neha.net).toBe((1_99_000 - 4_920 - 14_900 - 200) * RUPEE);
  });
  it("uses a reviewer's TDS instead of the estimate", () => {
    const p = computePayslip({ period: "2026-10", ctcAnnualPaise: 9_84_000 * RUPEE, daysPaid: 31, commission: 92_000 * RUPEE, incentive: 25_000 * RUPEE, tdsOverride: 12_000 * RUPEE });
    expect(p.tds).toBe(12_000 * RUPEE);
    expect(p.tdsOverridden).toBe(true);
    expect(p.net).toBe(1_81_880 * RUPEE);
  });
  it("prorates fixed pay for a mid-month joiner", () => {
    const p = computePayslip({ period: "2026-10", ctcAnnualPaise: 6_00_000 * RUPEE, daysPaid: daysPaidFor("2026-10", "2026-10-17") });
    expect(p.daysPaid).toBe(15);
    expect(p.basic).toBe(Math.round(25_000 * RUPEE * (15 / 31)));
  });
});

describe("days on payroll", () => {
  it("counts from the joining day to month end", () => {
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysPaidFor("2026-10", null)).toBe(31);
    expect(daysPaidFor("2026-10", "2021-03-12")).toBe(31);
    expect(daysPaidFor("2026-10", "2026-10-01")).toBe(31);
    expect(daysPaidFor("2026-10", "2026-10-31")).toBe(1);
    expect(daysPaidFor("2026-10", "2026-11-02")).toBe(0);
  });
});

describe("statement periods", () => {
  it("validates and expands keys", () => {
    expect(statementPeriod("MONTHLY", "2026-10")?.months).toEqual(["2026-10"]);
    expect(statementPeriod("MONTHLY", "2026-13")).toBeNull();
    expect(statementPeriod("QUARTERLY", "FY2026-27-Q3")?.months).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(statementPeriod("QUARTERLY", "FY2026-27-Q4")?.months).toEqual(["2027-01", "2027-02", "2027-03"]);
    expect(statementPeriod("YEARLY", "FY2026-27")?.months).toHaveLength(12);
    expect(statementPeriod("YEARLY", "FY2026-28")).toBeNull();
    expect(statementPeriod("QUARTERLY", "../../etc")).toBeNull();
  });
  it("offers only periods with paid months, newest first", () => {
    const paid = ["2026-03", "2026-04", "2026-09", "2026-10"];
    expect(statementOptions("MONTHLY", paid).map((o) => o.key)).toEqual(["2026-10", "2026-09", "2026-04", "2026-03"]);
    expect(statementOptions("QUARTERLY", paid).map((o) => o.key)).toEqual(["FY2026-27-Q3", "FY2026-27-Q2", "FY2026-27-Q1", "FY2025-26-Q4"]);
    expect(statementOptions("YEARLY", paid).map((o) => o.key)).toEqual(["FY2026-27", "FY2025-26"]);
  });
  it("sums months for statements", () => {
    const a = computePayslip({ period: "2026-09", ctcAnnualPaise: 6_00_000 * RUPEE, daysPaid: 30 });
    const b = computePayslip({ period: "2026-10", ctcAnnualPaise: 6_00_000 * RUPEE, daysPaid: 31 });
    const s = sumComponents([a, b]);
    expect(s.gross).toBe(a.gross + b.gross);
    expect(s.net).toBe(a.net + b.net);
    expect(s.daysPaid).toBe(61);
  });
});

describe("amount in words (Indian system)", () => {
  it.each([
    [6_42_960 * RUPEE, "Rupees Six Lakh Forty-Two Thousand Nine Hundred Sixty Only"],
    [1_81_880 * RUPEE, "Rupees One Lakh Eighty-One Thousand Eight Hundred Eighty Only"],
    [2_07_57_000 * RUPEE, "Rupees Two Crore Seven Lakh Fifty-Seven Thousand Only"],
    [100 * RUPEE, "Rupees One Hundred Only"],
    [0, "Rupees Zero Only"],
    [1_234_56, "Rupees One Thousand Two Hundred Thirty-Four and Fifty-Six Paise Only"],
  ])("%d paise", (paise, words) => expect(amountInWords(paise)).toBe(words));
});

describe("payroll inputs", () => {
  it("start: real months only", () => {
    expect(startRunSchema.safeParse({ period: "2026-10", payDate: "2026-10-31" }).success).toBe(true);
    expect(startRunSchema.safeParse({ period: "2026-1", payDate: "2026-10-31" }).success).toBe(false);
  });
  it("payslip edits: non-negative amounts, TDS may fall back to the estimate", () => {
    const base = { id: "01a16334-418e-7061-ad0d-0a2bf1c6a0d2", commissionPaise: 0, incentivePaise: 0, otherPaise: 0, tdsPaise: null, onHold: false, note: "" };
    expect(payslipEditSchema.safeParse(base).success).toBe(true);
    expect(payslipEditSchema.safeParse({ ...base, commissionPaise: -1 }).success).toBe(false);
    expect(payslipEditSchema.safeParse({ ...base, otherPaise: 2_00_00_000_00 }).success).toBe(false);
  });
});
