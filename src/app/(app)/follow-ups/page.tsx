import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FollowUpsScreen } from "@/components/tasks/followups-screen";
import { isoDateIST } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/policy";
import { linkableLeads, listFollowUps, listTasks } from "@/server/services/tasks";
import { activeUserOptions } from "@/server/services/wip";

export const metadata: Metadata = { title: "Follow-ups & Tasks" };

export default async function FollowUpsPage() {
  const user = await requireUser();
  if (!can(user, "view", { type: "task" })) notFound();
  const now = new Date();
  const [followUps, tasks, users, leads] = await Promise.all([listFollowUps(user), listTasks(user), activeUserOptions(), linkableLeads(user)]);
  return <FollowUpsScreen followUps={followUps} tasks={tasks} users={users} leads={leads} me={user.id} today={isoDateIST(now)} now={now.toISOString()} />;
}
