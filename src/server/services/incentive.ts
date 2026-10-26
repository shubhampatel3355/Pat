import "server-only";
import type { WipRemark } from "@/generated/prisma/enums";
import { fyOfIso, isoDateIST, istToInstant } from "@/lib/dates";
import { dealShare, incentivePaise, incentiveStatus, type IncentiveStatus } from "@/lib/incentive";
import { toPaise } from "@/lib/money";
import { db } from "../db";

export interface IncentiveRowDto {
  leadId: string;
  tenantName: string;
  building: string;
  remark: WipRemark;
  feePaise: number;
  sharePct: number;
  incentivePaise: number;
  status: IncentiveStatus;
}

export interface IncentiveSummary {
  fyLabel: string;
  rows: IncentiveRowDto[];
  earnedPaise: number;
  expectedPaise: number;
}

/**
 * One person's incentive over their WIP rows: every deal still in play, plus deals that were won or
 * dropped during the current financial year (older closed deals are history).
 */
export async function incentiveFor(userId: string, today = isoDateIST()): Promise<IncentiveSummary> {
  const fy = fyOfIso(today);
  const fyStart = istToInstant(fy.start);
  const leads = await db.lead.findMany({
    where: { deletedAt: null, brokers: { some: { userId } } },
    orderBy: { serial: "asc" },
    include: {
      brokers: { select: { userId: true, sharePct: true } },
      invoices: {
        where: { type: "INVOICE", status: { not: "CANCELLED" } },
        include: { brokers: { select: { userId: true, sharePct: true } }, creditNotes: { where: { status: { not: "CANCELLED" } }, select: { feesPaise: true } } },
      },
    },
  });

  const rows = leads.flatMap((l): IncentiveRowDto[] => {
    const status = incentiveStatus(l.remark);
    if (status !== "EXPECTED" && l.remarkChangedAt < fyStart) return [];
    const { feePaise, sharePct } = dealShare({
      userId,
      estFeePaise: toPaise(l.estFeesPaise),
      leadBrokers: l.brokers,
      invoices: l.invoices.map((i) => ({
        netFeesPaise: toPaise(i.feesPaise) - i.creditNotes.reduce((a, c) => a + toPaise(c.feesPaise), 0),
        split: i.brokers,
      })),
    });
    return [{ leadId: l.id, tenantName: l.tenantName, building: l.building || l.location, remark: l.remark, feePaise, sharePct, incentivePaise: incentivePaise(feePaise, sharePct, status), status }];
  });

  const sum = (s: IncentiveStatus) => rows.filter((r) => r.status === s).reduce((a, r) => a + r.incentivePaise, 0);
  return { fyLabel: fy.label, rows, earnedPaise: sum("EARNED"), expectedPaise: sum("EXPECTED") };
}
