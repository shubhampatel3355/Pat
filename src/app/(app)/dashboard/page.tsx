import type { Metadata } from "next";
import { formatLongDate, hourIST, isoDateIST } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import { currentView } from "@/server/view";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const view = await currentView(user);
  const viewLabel = view.partner ? `Partner View · ${view.partner.name}` : "Company View";
  return (
    <div className="flex flex-col gap-3 pl-[clamp(0px,3vw,48px)] pt-9">
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 items-center gap-1.5 rounded-pill px-2.5 text-[11px] font-medium"
          style={{ background: view.partner ? "rgba(2,62,125,.14)" : "#C7C7C7", color: view.partner ? "#001233" : "#55555A" }}
        >
          <span className="h-1.5 w-1.5 rounded-pill" style={{ background: view.partner ? "#001233" : "#55555A" }} />
          {viewLabel}
        </span>
        <span className="text-xs text-muted">{formatLongDate(isoDateIST())}</span>
      </div>
      <h1 className="m-0 text-[44px] font-light leading-[48px] tracking-[-.02em]">
        {greeting(hourIST())}, {user.firstName}
      </h1>
      <p className="m-0 text-sm text-muted">You are signed in as {user.role.toLowerCase()}. Modules arrive milestone by milestone.</p>
    </div>
  );
}
