import type { Metadata } from "next";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import { formatLongDate, hourIST, isoDateIST } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import { dashboardData } from "@/server/services/dashboard";
import { currentView } from "@/server/view";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const view = await currentView(user);
  const data = await dashboardData(user, view);
  return <DashboardScreen data={data} greeting={`${greeting(hourIST())}, ${user.firstName}`} dateLabel={formatLongDate(isoDateIST())} />;
}
