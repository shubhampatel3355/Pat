import { describe, expect, it } from "vitest";
import { financialYear } from "@/lib/dates";
import { ageingBucket, changePct, daysOverdue, expenseGroupOf, financePeriod, groupExpenses, safeCellText, sharePct, yoyLabel } from "@/lib/finance";
import { financeExportQuerySchema, ledgerEntryInputSchema, voidLedgerEntrySchema } from "@/lib/schemas/finance";

describe("financePeriod", () => {
  it("is year to date while the FY runs, compared with the same dates last year", () => {
    const p = financePeriod(financialYear(2026), "2026-10-22");
    expect(p).toMatchObject({ toDate: true, from: "2026-04-01", to: "2026-10-22", label: "Apr – Oct 2026", prevFrom: "2025-04-01", prevTo: "2025-10-22" });
  });
  it("covers the whole year once it has ended", () => {
    const p = financePeriod(financialYear(2025), "2026-10-22");
    expect(p).toMatchObject({ toDate: false, from: "2025-04-01", to: "2026-03-31", label: "Apr 2025 – Mar 2026", prevFrom: "2024-04-01", prevTo: "2025-03-31" });
  });
  it("compares 29 Feb with 28 Feb", () => expect(financePeriod(financialYear(2027), "2028-02-29").prevTo).toBe("2027-02-28"));
  it("labels the first month on its own", () => expect(financePeriod(financialYear(2026), "2026-04-15").label).toBe("Apr 2026"));
});

describe("expense groups (Expenses card)", () => {
  it("maps categories to Vendors · Salaries · Marketing · Other", () => {
    expect(expenseGroupOf("Vendor payments")).toBe("Vendors");
    expect(expenseGroupOf("Salaries")).toBe("Salaries");
    expect(expenseGroupOf("Marketing")).toBe("Marketing");
    expect(expenseGroupOf("Rent")).toBe("Other");
    expect(expenseGroupOf("Something new")).toBe("Other");
  });
  it("sums into four fixed groups in card order", () => {
    const groups = groupExpenses([
      { category: "Rent", paise: 300 },
      { category: "Salaries", paise: 500 },
      { category: "Cab", paise: 50 },
      { category: "Vendor payments", paise: 100 },
    ]);
    expect(groups.map((g) => [g.tick, g.paise])).toEqual([
      ["Vendors", 100],
      ["Salaries", 500],
      ["Mktg", 0],
      ["Other", 350],
    ]);
  });
});

describe("year-on-year and shares", () => {
  it("rounds the change", () => expect(changePct(114, 100)).toBe(14));
  it("has no comparison without last year's figure", () => {
    expect(changePct(50, 0)).toBeNull();
    expect(yoyLabel(50, 0)).toBe("");
  });
  it("formats with a true minus sign", () => {
    expect(yoyLabel(114, 100)).toBe("+14% YoY");
    expect(yoyLabel(94, 100)).toBe("−6% YoY");
    expect(yoyLabel(100, 100)).toBe("0% YoY");
  });
  it("sharePct needs a positive whole", () => {
    expect(sharePct(1, 3)).toBe(33);
    expect(sharePct(5, 0)).toBeNull();
    expect(sharePct(-5, 100)).toBe(-5);
  });
});

describe("receivables ageing", () => {
  const today = "2026-10-22";
  it.each([
    [null, 0, 0],
    ["2026-11-01", 0, 0],
    ["2026-10-22", 0, 0],
    ["2026-10-21", 1, 1],
    ["2026-09-22", 30, 1],
    ["2026-09-21", 31, 2],
    ["2026-08-23", 60, 2],
    ["2026-08-22", 61, 3],
  ] as const)("due %s → %d days, bucket %d", (due, days, bucket) => {
    expect(daysOverdue(due, today)).toBe(days);
    expect(ageingBucket(due, today)).toBe(bucket);
  });
});

describe("spreadsheet formula-injection guard", () => {
  it.each(["=SUM(A1:A9)", "+91 98450 21734", "-2+3", "@cmd", "\tx", "\rx"])("escapes %j", (v) => expect(safeCellText(v)).toBe(`'${v}`));
  it.each(["Zeta Fintech", "— none", "12,36,640", ""])("leaves %j alone", (v) => expect(safeCellText(v)).toBe(v));
});

describe("ledger entry input", () => {
  const valid = { type: "EXPENSE", amountPaise: 4_500_000, party: "PrintHub", description: "Visiting cards", category: "Marketing", mode: "UPI", entryDate: "2026-10-22" } as const;
  it("accepts a normal expense", () => expect(ledgerEntryInputSchema.safeParse(valid).success).toBe(true));
  it("checks the category belongs to the entry type", () => {
    expect(ledgerEntryInputSchema.safeParse({ ...valid, type: "INCOME" }).success).toBe(false);
    expect(ledgerEntryInputSchema.safeParse({ ...valid, type: "INCOME", category: "Other income" }).success).toBe(true);
  });
  it.each([
    ["zero amount", { amountPaise: 0 }],
    ["fractional paise", { amountPaise: 10.5 }],
    ["absurd amount", { amountPaise: 2_000_000_000_000 }],
    ["short description", { description: "ok" }],
    ["unknown mode", { mode: "BITCOIN" }],
    ["impossible date", { entryDate: "2026-02-30x" }],
  ])("rejects %s", (_, patch) => expect(ledgerEntryInputSchema.safeParse({ ...valid, ...patch }).success).toBe(false));
  it("strips control characters", () => {
    const r = ledgerEntryInputSchema.parse({ ...valid, description: "  Cards\u0000 for team  " });
    expect(r.description).toBe("Cards for team");
  });
  it("voiding needs a reason", () => {
    expect(voidLedgerEntrySchema.safeParse({ id: "01a16334-418e-7061-ad0d-0a2bf1c6a0d2", reason: "" }).success).toBe(false);
    expect(voidLedgerEntrySchema.safeParse({ id: "01a16334-418e-7061-ad0d-0a2bf1c6a0d2", reason: "Entered twice" }).success).toBe(true);
  });
});

describe("finance export query", () => {
  it("coerces the year", () => expect(financeExportQuerySchema.parse({ fy: "2026", format: "xlsx" })).toEqual({ fy: 2026, format: "xlsx" }));
  it("only offers XLSX and PDF", () => expect(financeExportQuerySchema.safeParse({ fy: "2026", format: "csv" }).success).toBe(false));
  it("rejects nonsense years", () => expect(financeExportQuerySchema.safeParse({ fy: "26", format: "pdf" }).success).toBe(false));
});
