import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { FormPrefill } from "@/components/invoice/document-form";
import { InvoiceScreen } from "@/components/invoice/invoice-screen";
import { isoDateIST } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import { companyProfile } from "@/server/company";
import { can, has } from "@/server/policy";
import { invoicePrefill, listDocuments, peekNumber } from "@/server/services/invoices";
import { activeUserOptions } from "@/server/services/wip";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "view", { type: "invoice" })) notFound();
  const sp = await searchParams;
  const mode = sp.mode === "proforma" ? "proforma" : "invoice";
  const today = isoDateIST();

  const prefill: FormPrefill | null = typeof sp.lead === "string" ? await invoicePrefill(user, sp.lead) : null;

  const [invoices, proformas, nextInvoice, nextProforma, users] = await Promise.all([
    listDocuments(user, ["INVOICE", "CREDIT_NOTE"]),
    listDocuments(user, ["PROFORMA"]),
    peekNumber("INVOICE", today),
    peekNumber("PROFORMA", today),
    activeUserOptions(),
  ]);

  return (
    <InvoiceScreen
      mode={mode}
      invoices={invoices}
      proformas={proformas}
      nextInvoice={nextInvoice}
      nextProforma={nextProforma}
      today={today}
      users={users}
      company={companyProfile()}
      prefill={prefill}
      can={{ create: has(user, "invoices.create"), record: has(user, "finance.record"), creditNote: has(user, "invoices.credit_note") }}
    />
  );
}
