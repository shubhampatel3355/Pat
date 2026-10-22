import { describe, expect, it } from "vitest";
import { checkGstin, computeGst, gstinCheckChar } from "@/lib/gstin";

describe("GSTIN validation", () => {
  it("accepts published, valid GSTINs", () => {
    expect(checkGstin("27AAPFU0939F1ZV")).toEqual({ ok: true, stateCode: "27" });
    expect(checkGstin("24AAACC1206D1ZM")).toEqual({ ok: true, stateCode: "24" });
  });
  it("normalises case and spacing", () => expect(checkGstin(" 27aapfu0939f1zv ").ok).toBe(true));
  it("rejects a wrong check character", () => expect(checkGstin("27AAPFU0939F1ZW")).toEqual({ ok: false, reason: "checksum" }));
  it("rejects bad length and format", () => {
    expect(checkGstin("27AAPFU0939F1Z")).toEqual({ ok: false, reason: "length" });
    expect(checkGstin("2AAAPFU0939F1ZV")).toEqual({ ok: false, reason: "format" });
  });
  it("rejects unknown state codes", () => {
    const base = "99AAPFU0939F1Z";
    expect(checkGstin(base + gstinCheckChar(base))).toEqual({ ok: false, reason: "state" });
  });
  it("computes the company default GSTIN check digit", () => expect(gstinCheckChar("29AAKFP4821L1Z")).toBe("R"));
});

describe("GST split (18%)", () => {
  it("is CGST + SGST within Karnataka", () => {
    const g = computeGst(1_150_000_00, "29");
    expect(g).toMatchObject({ intraState: true, cgstPaise: 103_500_00, sgstPaise: 103_500_00, igstPaise: 0, totalPaise: 1_357_000_00 });
  });
  it("is IGST for other states", () => {
    const g = computeGst(1_150_000_00, "27");
    expect(g).toMatchObject({ intraState: false, cgstPaise: 0, sgstPaise: 0, igstPaise: 207_000_00, totalPaise: 1_357_000_00 });
  });
  it("keeps halves exact on odd paise", () => {
    const g = computeGst(101, "29"); // 18.18 → 18 paise
    expect(g.cgstPaise + g.sgstPaise).toBe(g.gstPaise);
    expect(g.totalPaise).toBe(101 + g.gstPaise);
  });
});
