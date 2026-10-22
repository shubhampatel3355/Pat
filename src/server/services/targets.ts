import "server-only";
import type { TargetMetric, TargetScope } from "@/generated/prisma/enums";
import { toPaise } from "@/lib/money";
import { db } from "../db";

export async function getTarget(scope: TargetScope, scopeKey: string, metric: TargetMetric, period: string): Promise<number | null> {
  const row = await db.target.findUnique({ where: { scope_scopeKey_metric_period: { scope, scopeKey, metric, period } } });
  return row ? toPaise(row.amountPaise) : null;
}

/** All targets of one metric/period, keyed by scope key (e.g. user id → amount). */
export async function targetsByScope(scope: TargetScope, metric: TargetMetric, period: string): Promise<Map<string, number>> {
  const rows = await db.target.findMany({ where: { scope, metric, period } });
  return new Map(rows.map((r) => [r.scopeKey, toPaise(r.amountPaise)]));
}
