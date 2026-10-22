import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { getApiUser } from "@/server/auth/session";
import { companyProfile } from "@/server/company";
import { verifyPayload } from "@/server/crypto";
import { db } from "@/server/db";
import { has } from "@/server/policy";
import { invoiceInclude, toDocData } from "@/server/services/invoices";

export const metadata: Metadata = { title: "Invoice" };

/** Bare, printable invoice. Used by Chromium (signed `t` token) and by signed-in users with invoice access. */
export default async function PrintInvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const token = verifyPayload<{ kind: string; id: string }>("print", typeof sp.t === "string" ? sp.t : null);
  let allowed = token?.kind === "invoice" && token.id === id;
  if (!allowed) {
    const user = await getApiUser();
    allowed = Boolean(user && has(user, "invoices.view"));
  }
  if (!allowed || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const invoice = await db.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice) notFound();
  return (
    <main style={{ display: "flex", justifyContent: "center", background: "#fff" }}>
      <InvoiceDocument data={toDocData(invoice)} company={companyProfile()} flat />
    </main>
  );
}
