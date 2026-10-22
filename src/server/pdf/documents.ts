import "server-only";
import { db } from "../db";
import { storage } from "../storage";
import { renderPdf } from "./render";

/**
 * Issued invoices, proformas and credit notes never change, so their PDF is rendered once and kept in
 * object storage (invoices.pdf_key); later downloads and emails reuse the stored copy.
 */
export async function invoicePdf(invoiceId: string): Promise<{ filename: string; bytes: Buffer }> {
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { id: true, number: true, fy: true, pdfKey: true } });
  const filename = `${inv.number.replace(/\//g, "-")}.pdf`;
  if (inv.pdfKey) {
    try {
      return { filename, bytes: await storage().get(inv.pdfKey) };
    } catch {
      // Missing object (e.g. restored database without the bucket): render again below.
    }
  }
  const bytes = await renderPdf({ kind: "invoice", id: inv.id });
  const key = `documents/invoices/${inv.fy}/${filename}`;
  await storage().put(key, bytes, "application/pdf");
  await db.invoice.update({ where: { id: inv.id }, data: { pdfKey: key } });
  return { filename, bytes };
}
