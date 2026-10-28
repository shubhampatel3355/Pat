import { describe, expect, it } from "vitest";
import { formatAmountInput, formatCompactINR, formatINR, groupIndian, paiseToInput, parseRupeesToPaise, sharePaise, toPaise } from "@/lib/money";

describe("Indian digit grouping", () => {
  it.each([
    ["0", "0"],
    ["999", "999"],
    ["1000", "1,000"],
    ["100000", "1,00,000"],
    ["1236640", "12,36,640"],
    ["150000000", "15,00,00,000"],
    ["-1236640", "-12,36,640"],
  ])("%s → %s", (input, expected) => expect(groupIndian(input)).toBe(expected));
});

describe("formatAmountInput (as typed)", () => {
  it.each([
    ["", ""],
    ["5", "5"],
    ["1120555", "11,20,555"],
    ["11,20,555", "11,20,555"],
    ["1,1,2,0555", "11,20,555"],
    ["₹ 2,50,000", "2,50,000"],
    ["abc12x34", "1,234"],
    ["007", "7"],
    ["0", "0"],
    ["1234.", "1,234."],
    ["1234.5", "1,234.5"],
    ["1234.567", "1,234.56"],
    ["12.3.4", "12.34"],
    [".5", "0.5"],
    ["0.50", "0.50"],
  ])("%j → %j", (input, expected) => expect(formatAmountInput(input)).toBe(expected));

  it("whole numbers only when decimals are off", () => {
    expect(formatAmountInput("45,00.7", false)).toBe("45,007");
    expect(formatAmountInput("10000", false)).toBe("10,000");
  });

  it("parses back to the same paise", () => {
    for (const typed of ["1120555", "1234.5", "99999999.99"]) {
      expect(parseRupeesToPaise(formatAmountInput(typed))).toBe(parseRupeesToPaise(typed));
    }
  });
});

describe("formatINR", () => {
  it("rounds to whole rupees by default", () => expect(formatINR(123_664_049)).toBe("₹ 12,36,640"));
  it("shows paise when asked", () => expect(formatINR(123_664_005, { paiseDigits: true })).toBe("₹ 12,36,640.05"));
  it("handles negatives with a real minus sign", () => expect(formatINR(-50_000)).toBe("−₹ 500"));
});

describe("formatCompactINR (cards)", () => {
  it.each([
    [2_000_000_00, "₹ 20 L"],
    [1_500_000_000, "₹ 1.5 Cr"],
    [24_00_00_000_00, "₹ 24 Cr"],
    [12_345_678_00, "₹ 1.23 Cr"],
    [4_200_000, "₹ 42 K"],
    [95_000, "₹ 950"],
  ])("%d paise → %s", (paise, expected) => expect(formatCompactINR(paise)).toBe(expected));
});

describe("parseRupeesToPaise", () => {
  it.each([
    ["11,50,000", 115_000_000],
    ["₹ 92.5", 9_250],
    ["92.05", 9_205],
    ["1150000", 115_000_000],
    [" 0 ", 0],
  ])("%s → %d", (input, expected) => expect(parseRupeesToPaise(input)).toBe(expected));
  it.each(["", "abc", "1.234", "-5", "1,2,3.4.5"])("rejects %s", (input) => expect(parseRupeesToPaise(input)).toBeNull());
  it("round-trips through the input formatter", () => expect(parseRupeesToPaise(paiseToInput(115_000_050))).toBe(115_000_050));
});

describe("helpers", () => {
  it("converts bigint columns safely", () => expect(toPaise(BigInt(123))).toBe(123));
  it("refuses unsafe integers", () => expect(() => toPaise(BigInt("90071992547409930"))).toThrow(RangeError));
  it("splits shares to the paisa", () => expect(sharePaise(100_001, 50)).toBe(50_001));
});
