import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BdScreen } from "@/components/bd/bd-screen";
import { isoDateIST } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/policy";
import { listBdMeetings } from "@/server/services/bd";
import { activeUserOptions } from "@/server/services/wip";

export const metadata: Metadata = { title: "Business Development" };

export default async function BusinessDevelopmentPage() {
  const user = await requireUser();
  if (!can(user, "view", { type: "bd" })) notFound();
  const [rows, users] = await Promise.all([listBdMeetings(user), activeUserOptions()]);
  return <BdScreen rows={rows} users={users} me={user.id} today={isoDateIST()} canSeeContacts={can(user, "view_contacts", { type: "bd" })} />;
}
