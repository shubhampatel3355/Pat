import "server-only";
import type { CompanyProfile } from "@/lib/company";
import { env } from "./env";

export function companyProfile(): CompanyProfile {
  const e = env();
  const bank =
    e.COMPANY_BANK_NAME && e.COMPANY_BANK_ACCOUNT_NUMBER && e.COMPANY_BANK_IFSC
      ? { name: e.COMPANY_BANK_NAME, accountName: e.COMPANY_BANK_ACCOUNT_NAME ?? e.COMPANY_LEGAL_NAME, accountNumber: e.COMPANY_BANK_ACCOUNT_NUMBER, ifsc: e.COMPANY_BANK_IFSC, branch: e.COMPANY_BANK_BRANCH ?? null }
      : null;
  return {
    legalName: e.COMPANY_LEGAL_NAME,
    shortName: e.COMPANY_SHORT_NAME,
    address: e.COMPANY_ADDRESS,
    gstin: e.COMPANY_GSTIN,
    pan: e.COMPANY_PAN ?? null,
    rera: e.COMPANY_RERA,
    phone: e.COMPANY_PHONE,
    email: e.COMPANY_EMAIL,
    website: e.COMPANY_WEBSITE,
    sac: e.COMPANY_SAC_CODE,
    bank,
    signatory: { name: e.COMPANY_SIGNATORY_NAME, title: e.COMPANY_SIGNATORY_TITLE },
  };
}
