import type { WipRemark } from "@/generated/prisma/enums";

/**
 * Broker incentive, as shown to employees on "Payslips & Incentive" and their dashboard: 20 % of the
 * person's share of each deal's fee. Invoice Raised and Payment Collected count as earned; deals still in
 * play count at half, as expected; Lost and On Hold pay nothing. Amounts in paise.
 */
export const INCENTIVE_RATE = 0.2;
export const EXPECTED_WEIGHT = 0.5;

export type IncentiveStatus = "EARNED" | "EXPECTED" | "NO_PAYOUT";

export function incentiveStatus(remark: WipRemark): IncentiveStatus {
  if (remark === "INVOICE_RAISED" || remark === "PAYMENT_COLLECTED") return "EARNED";
  if (remark === "LOST" || remark === "ON_HOLD") return "NO_PAYOUT";
  return "EXPECTED";
}

export function incentivePaise(feePaise: number, sharePct: number, status: IncentiveStatus): number {
  if (status === "NO_PAYOUT") return 0;
  return Math.round(feePaise * (sharePct / 100) * INCENTIVE_RATE * (status === "EXPECTED" ? EXPECTED_WEIGHT : 1));
}

interface SplitRow {
  userId: string | null;
  sharePct: number | null;
}

/** Share on the WIP row: the person's own share % if one is set, otherwise an equal split among its brokers. */
function leadSharePct(userId: string, brokers: SplitRow[]): number {
  const own = brokers.find((b) => b.userId === userId);
  if (!own) return 0;
  return own.sharePct ?? 100 / brokers.length;
}

/**
 * The deal's fee and the person's share of it. Before invoicing: the estimated fee and the WIP row's share.
 * Once invoiced: invoice fees net of credit notes, each invoice split by its own broker split (or the WIP
 * row's share when that invoice has none).
 */
export function dealShare(input: {
  userId: string;
  estFeePaise: number;
  leadBrokers: SplitRow[];
  invoices: { netFeesPaise: number; split: SplitRow[] }[];
}): { feePaise: number; sharePct: number } {
  const fallback = leadSharePct(input.userId, input.leadBrokers);
  if (!input.invoices.length) return { feePaise: input.estFeePaise, sharePct: fallback };
  let fee = 0;
  let mine = 0;
  for (const inv of input.invoices) {
    const pct = inv.split.length ? inv.split.filter((b) => b.userId === input.userId).reduce((a, b) => a + (b.sharePct ?? 0), 0) : fallback;
    fee += inv.netFeesPaise;
    mine += inv.netFeesPaise * (pct / 100);
  }
  return { feePaise: fee, sharePct: fee > 0 ? (mine / fee) * 100 : fallback };
}
