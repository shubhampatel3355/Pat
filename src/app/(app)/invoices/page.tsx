import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { FormPrefill, ShareRow } from "@/components/invoice/document-form";
import { InvoiceScreen } from "@/components/invoice/invoice-screen";
import { isoDateIST } from "@/lib/dates";
import { paiseToInput, toPaise } from "@/lib/money";
import { areaLabel } from "@/lib/wip";
import { requireUser } from "@/server/auth/session";
import { companyProfile } from "@/server/company";
import { db } from "@/server/db";
import { can, has } from "@/server/policy";
import { wipScope } from "@/server/policy/scopes";
import { listDocuments, peekNumber } from "@/server/services/invoices";
import { activeUserOptions, leadInclude } from "@/server/services/wip";

export const metadata: Metadata = { title: "Invoice" };

/** Equal split that always totals 100 (e.g. 34 / 33 / 33). */
function evenShares(n: number): number[] {
  const base = Math.floor(100 / n);
  return Array.from({ length: n }, (_, i) => base + (i < 100 - base * n ? 1 : 0));
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "view", { type: "invoice" })) notFound();
  const sp = await searchParams;
  const mode = sp.mode === "proforma" ? "proforma" : "invoice";
  const today = isoDateIST();

  let prefill: FormPrefill | null = null;
  if (typeof sp.lead === "string" && /^[0-9a-f-]{36}$/i.test(sp.lead) && has(user, "invoices.create")) {
    const lead = await db.lead.findFirst({ where: { AND: [wipScope(user), { id: sp.lead }] }, include: leadInclude });
    if (lead) {
      const shares = evenShares(Math.max(1, lead.brokers.length));
      const brokers: ShareRow[] = lead.brokers.map((b, i) => (b.userId ? { kind: "user", userId: b.userId, pct: String(shares[i]) } : { kind: "external", name: b.externalName ?? "", pct: String(shares[i]) }));
      const space = areaLabel(lead.pricingBasis, lead.areaSqft, lead.seats);
      prefill = {
        leadId: lead.id,
        leadName: lead.tenantName,
        payeeName: lead.tenantName,
        narration: `Brokerage — ${space !== "—" ? `${space} at ` : ""}${lead.building ?? lead.location}`,
        feesRupees: paiseToInput(toPaise(lead.estFeesPaise)),
        brokers,
      };
    }
  }

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
