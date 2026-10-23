import "server-only";
import type { StatementType } from "@/lib/payroll";
import { db } from "../db";
import { statementFor } from "../services/payroll";
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

const fileSafe = (s: string) => s.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * A payslip (monthly) or pay statement (quarterly / yearly). Monthly payslips of disbursed runs never
 * change, so their PDF is kept in storage (payslips.pdf_key); statements over several months are
 * rendered on demand.
 */
export async function payslipPdf(userId: string, type: StatementType, key: string): Promise<{ filename: string; bytes: Buffer } | null> {
  const statement = await statementFor(userId, type, key);
  if (!statement) return null;
  const filename = `${type === "MONTHLY" ? "Payslip" : "Pay-statement"}-${fileSafe(statement.user.name)}-${fileSafe(key)}.pdf`;
  const slip = statement.payslipId ? await db.payslip.findUnique({ where: { id: statement.payslipId }, select: { id: true, pdfKey: true } }) : null;
  if (slip?.pdfKey) {
    try {
      return { filename, bytes: await storage().get(slip.pdfKey) };
    } catch {
      // Missing object: render again below.
    }
  }
  const bytes = await renderPdf({ kind: "payslip", userId, periodType: type, period: key });
  if (slip) {
    const storageKey = `documents/payslips/${key}/${userId}.pdf`;
    await storage().put(storageKey, bytes, "application/pdf");
    await db.payslip.update({ where: { id: slip.id }, data: { pdfKey: storageKey } });
  }
  return { filename, bytes };
}
