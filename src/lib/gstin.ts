/**
 * GSTIN: 2-digit state code + 10-char PAN + entity number + "Z" + check character.
 * The check character is a Luhn mod-36 digit over the first 14 characters.
 */

const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function gstinCheckChar(first14: string): string {
  let factor = 2;
  let sum = 0;
  for (let i = first14.length - 1; i >= 0; i--) {
    let addend = factor * CHARSET.indexOf(first14[i]);
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / 36) + (addend % 36);
    sum += addend;
  }
  return CHARSET[(36 - (sum % 36)) % 36];
}

type GstinCheck = { ok: true; stateCode: string } | { ok: false; reason: "length" | "format" | "checksum" | "state" };

export function normaliseGstin(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function checkGstin(input: string): GstinCheck {
  const g = normaliseGstin(input);
  if (g.length !== 15) return { ok: false, reason: "length" };
  if (!GSTIN_PATTERN.test(g)) return { ok: false, reason: "format" };
  const state = Number(g.slice(0, 2));
  if (state < 1 || state > 38) return { ok: false, reason: "state" };
  if (gstinCheckChar(g.slice(0, 14)) !== g[14]) return { ok: false, reason: "checksum" };
  return { ok: true, stateCode: g.slice(0, 2) };
}

export function gstinErrorMessage(reason: Exclude<GstinCheck, { ok: true }>["reason"]): string {
  switch (reason) {
    case "length":
      return "GSTIN must be 15 characters";
    case "format":
      return "GSTIN format looks wrong (e.g. 29AAKFP4821L1ZR)";
    case "state":
      return "GSTIN starts with an unknown state code";
    case "checksum":
      return "GSTIN check digit doesn't match — please re-check it";
  }
}

export const STATE_NAMES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

interface GstSplit {
  intraState: boolean;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  gstPaise: number;
  totalPaise: number;
}

/**
 * GST at 18% on fees. Intra-state (buyer state == company state, Karnataka "29" by default):
 * CGST 9% + SGST 9%. Otherwise IGST 18%. Amounts rounded to the paisa; CGST/SGST split so they sum exactly.
 */
export function computeGst(feesPaise: number, buyerStateCode: string | null, companyStateCode = "29"): GstSplit {
  const gstPaise = Math.round(feesPaise * 0.18);
  const intraState = !buyerStateCode || buyerStateCode === companyStateCode;
  if (intraState) {
    const cgstPaise = Math.floor(gstPaise / 2);
    return { intraState, cgstPaise, sgstPaise: gstPaise - cgstPaise, igstPaise: 0, gstPaise, totalPaise: feesPaise + gstPaise };
  }
  return { intraState, cgstPaise: 0, sgstPaise: 0, igstPaise: gstPaise, gstPaise, totalPaise: feesPaise + gstPaise };
}
