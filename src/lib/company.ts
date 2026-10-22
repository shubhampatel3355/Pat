/** Company letterhead details printed on invoices, payslips and exports (from COMPANY_* env vars). */
export interface CompanyProfile {
  legalName: string;
  shortName: string;
  address: string;
  gstin: string;
  pan: string | null;
  rera: string;
  phone: string;
  email: string;
  website: string;
  sac: string;
  bank: { name: string; accountName: string; accountNumber: string; ifsc: string; branch: string | null } | null;
  signatory: { name: string; title: string };
}

/** Everything the branded invoice / proforma / credit note (#pm-doc) needs, already formatted. */
export interface InvoiceDocData {
  kind: "INVOICE" | "PROFORMA" | "CREDIT_NOTE";
  number: string;
  draft: boolean;
  date: string;
  validUntil: string | null;
  dueDate: string | null;
  payeeName: string;
  billingAddress: string;
  gstin: string;
  placeOfSupply: string;
  contact: string;
  paymentTerms: string;
  narration: string;
  fees: string;
  lines: { label: string; value: string; strong?: boolean }[];
  brokers: { name: string; pct: number }[];
  /** Credit notes: which invoice they reverse, and why. */
  reference: string | null;
}
