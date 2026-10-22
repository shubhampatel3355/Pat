import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WipScreen, type WipCard } from "@/components/wip/wip-screen";
import { addDaysIso, isoDateIST } from "@/lib/dates";
import { formatCompactINR } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { can, has } from "@/server/policy";
import { activeUserOptions, listWip, wipCards, wipTarget } from "@/server/services/wip";

export const metadata: Metadata = { title: "WIP" };

function lastDayOfMonth(iso: string, monthsAhead = 0): string {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + monthsAhead + 1, 0));
  return d.toISOString().slice(0, 10);
}

export default async function WipPage() {
  const user = await requireUser();
  if (!can(user, "view", { type: "wip" })) notFound();
  const today = isoDateIST();
  const [rows, target, users] = await Promise.all([listWip(user), wipTarget(user, today), activeUserOptions()]);
  const { quarterLabel, currentPaise, mandates } = wipCards(rows, today);

  const t = target ?? 0;
  const gap = t - currentPaise;
  const pct = t ? Math.min(1, currentPaise / t) : 0;
  const cards: WipCard[] = [
    {
      title: "Target",
      icon: "target",
      value: target === null ? "—" : formatCompactINR(t),
      tag: quarterLabel,
      widthPct: target === null ? 0 : 100,
      sub: target === null ? "No target set for this quarter" : "Estimated fees to close this quarter",
      bg: "#001233",
    },
    {
      title: "Current",
      icon: "trend",
      value: formatCompactINR(currentPaise),
      tag: `${mandates} mandate${mandates === 1 ? "" : "s"}`,
      widthPct: pct * 100,
      sub: t ? `${Math.round(pct * 100)}% of target · excludes Lost` : "Excludes Lost",
      bg: "#002855",
    },
    gap > 0 || target === null
      ? {
          title: "Pending / Deficit",
          icon: "clock",
          value: formatCompactINR(Math.max(0, gap)),
          tag: "Deficit",
          widthPct: t ? (Math.max(0, gap) / t) * 100 : 0,
          sub: t ? `${Math.round((gap / t) * 100)}% of target still to add` : "Set a target in Settings",
          bg: "#023E7D",
        }
      : { title: "Surplus", icon: "clock", value: formatCompactINR(-gap), tag: "Ahead", widthPct: 0, sub: "Target covered", bg: "#023E7D" },
  ];

  return (
    <WipScreen
      rows={rows}
      cards={cards}
      users={users}
      me={user.id}
      today={today}
      monthEnd={lastDayOfMonth(today)}
      defaultClosure={lastDayOfMonth(addDaysIso(today, 1), 1)}
      canCreate={can(user, "create", { type: "wip" })}
      canInvoice={has(user, "invoices.create")}
    />
  );
}
