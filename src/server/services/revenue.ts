import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { isoToDate } from "@/lib/dates";
import { db } from "../db";

/**
 * Revenue = fees (excluding GST) of tax invoices issued in the period, minus credit notes issued in
 * the period. Proformas are not revenue. Per-person / per-partner revenue follows each invoice's
 * broker split (share %); external brokers' shares stay with the company only.
 */

const toNumber = (v: bigint | number | string | null | undefined) => (v === null || v === undefined ? 0 : Number(v));

export interface BillingTotals {
  invoiceCount: number;
  invoiceFeesPaise: number;
  invoiceTotalPaise: number;
  creditCount: number;
  creditFeesPaise: number;
  creditTotalPaise: number;
}

/** Tax invoices and credit notes issued in the period: fees (excl. GST) and totals (incl. GST). */
export async function billingTotals(fromIso: string, toIso: string): Promise<BillingTotals> {
  const rows = await db.$queryRaw<{ type: string; n: number; fees: bigint | null; total: bigint | null }[]>`
    SELECT type::text AS type, COUNT(*)::int AS n, SUM(fees_paise)::bigint AS fees, SUM(total_paise)::bigint AS total
    FROM invoices
    WHERE type IN ('INVOICE', 'CREDIT_NOTE') AND status <> 'CANCELLED'
      AND issue_date BETWEEN ${isoToDate(fromIso)} AND ${isoToDate(toIso)}
    GROUP BY 1`;
  const inv = rows.find((r) => r.type === "INVOICE");
  const cn = rows.find((r) => r.type === "CREDIT_NOTE");
  return {
    invoiceCount: inv?.n ?? 0,
    invoiceFeesPaise: toNumber(inv?.fees),
    invoiceTotalPaise: toNumber(inv?.total),
    creditCount: cn?.n ?? 0,
    creditFeesPaise: toNumber(cn?.fees),
    creditTotalPaise: toNumber(cn?.total),
  };
}

export const revenueOf = (b: BillingTotals) => b.invoiceFeesPaise - b.creditFeesPaise;

export async function companyRevenue(fromIso: string, toIso: string): Promise<number> {
  return revenueOf(await billingTotals(fromIso, toIso));
}

/** Revenue attributed to each team member in the period (paise, rounded per invoice line). */
export async function revenueByUser(fromIso: string, toIso: string, userIds?: string[]): Promise<Map<string, number>> {
  if (userIds && !userIds.length) return new Map();
  const filter = userIds?.length ? Prisma.sql`AND ib.user_id IN (${Prisma.join(userIds.map((id) => Prisma.sql`${id}::uuid`))})` : Prisma.empty;
  const rows = await db.$queryRaw<{ user_id: string; total: bigint | null }[]>`
    SELECT ib.user_id, COALESCE(SUM(ROUND(i.fees_paise * ib.share_pct / 100.0) * CASE WHEN i.type = 'CREDIT_NOTE' THEN -1 ELSE 1 END), 0)::bigint AS total
    FROM invoices i
    JOIN invoice_brokers ib ON ib.invoice_id = i.id
    WHERE i.type IN ('INVOICE', 'CREDIT_NOTE') AND i.status <> 'CANCELLED'
      AND ib.user_id IS NOT NULL
      AND i.issue_date BETWEEN ${isoToDate(fromIso)} AND ${isoToDate(toIso)}
      ${filter}
    GROUP BY ib.user_id`;
  return new Map(rows.map((r) => [r.user_id, toNumber(r.total)]));
}

/** Revenue of a group of people (e.g. a partner's team). */
export async function teamRevenue(fromIso: string, toIso: string, userIds: string[]): Promise<number> {
  if (!userIds.length) return 0;
  const byUser = await revenueByUser(fromIso, toIso, userIds);
  let sum = 0;
  for (const v of byUser.values()) sum += v;
  return sum;
}

/** Revenue per calendar month ("YYYY-MM" → paise) for a period; optionally limited to a team. */
export async function monthlyRevenue(fromIso: string, toIso: string, userIds?: string[]): Promise<Map<string, number>> {
  if (userIds && !userIds.length) return new Map();
  if (userIds) {
    const filter = Prisma.sql`AND ib.user_id IN (${Prisma.join(userIds.map((id) => Prisma.sql`${id}::uuid`))})`;
    const rows = await db.$queryRaw<{ month: string; total: bigint | null }[]>`
      SELECT to_char(i.issue_date, 'YYYY-MM') AS month,
             COALESCE(SUM(ROUND(i.fees_paise * ib.share_pct / 100.0) * CASE WHEN i.type = 'CREDIT_NOTE' THEN -1 ELSE 1 END), 0)::bigint AS total
      FROM invoices i JOIN invoice_brokers ib ON ib.invoice_id = i.id
      WHERE i.type IN ('INVOICE', 'CREDIT_NOTE') AND i.status <> 'CANCELLED'
        AND i.issue_date BETWEEN ${isoToDate(fromIso)} AND ${isoToDate(toIso)} ${filter}
      GROUP BY 1`;
    return new Map(rows.map((r) => [r.month, toNumber(r.total)]));
  }
  const rows = await db.$queryRaw<{ month: string; total: bigint | null }[]>`
    SELECT to_char(issue_date, 'YYYY-MM') AS month,
           COALESCE(SUM(CASE WHEN type = 'CREDIT_NOTE' THEN -fees_paise ELSE fees_paise END), 0)::bigint AS total
    FROM invoices
    WHERE type IN ('INVOICE', 'CREDIT_NOTE') AND status <> 'CANCELLED'
      AND issue_date BETWEEN ${isoToDate(fromIso)} AND ${isoToDate(toIso)}
    GROUP BY 1`;
  return new Map(rows.map((r) => [r.month, toNumber(r.total)]));
}

/** Revenue per financial year (start year → paise), company-wide or for a team. */
export async function revenueByFy(userIds?: string[]): Promise<Map<number, number>> {
  if (userIds && !userIds.length) return new Map();
  const fyExpr = Prisma.sql`(CASE WHEN EXTRACT(MONTH FROM i.issue_date) >= 4 THEN EXTRACT(YEAR FROM i.issue_date) ELSE EXTRACT(YEAR FROM i.issue_date) - 1 END)::int`;
  const rows = userIds
    ? await db.$queryRaw<{ fy: number; total: bigint | null }[]>`
        SELECT ${fyExpr} AS fy,
               COALESCE(SUM(ROUND(i.fees_paise * ib.share_pct / 100.0) * CASE WHEN i.type = 'CREDIT_NOTE' THEN -1 ELSE 1 END), 0)::bigint AS total
        FROM invoices i JOIN invoice_brokers ib ON ib.invoice_id = i.id
        WHERE i.type IN ('INVOICE', 'CREDIT_NOTE') AND i.status <> 'CANCELLED'
          AND ib.user_id IN (${Prisma.join(userIds.map((id) => Prisma.sql`${id}::uuid`))})
        GROUP BY 1`
    : await db.$queryRaw<{ fy: number; total: bigint | null }[]>`
        SELECT ${fyExpr} AS fy, COALESCE(SUM(CASE WHEN i.type = 'CREDIT_NOTE' THEN -i.fees_paise ELSE i.fees_paise END), 0)::bigint AS total
        FROM invoices i
        WHERE i.type IN ('INVOICE', 'CREDIT_NOTE') AND i.status <> 'CANCELLED'
        GROUP BY 1`;
  return new Map(rows.map((r) => [Number(r.fy), toNumber(r.total)]));
}
