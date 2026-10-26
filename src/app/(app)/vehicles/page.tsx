import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VehiclesScreen } from "@/components/vehicles/vehicles-screen";
import { defaultPickupSlot, isoDateIST } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/policy";
import { bookingPeople, cabStats, listCabBookings, pickupSuggestions } from "@/server/services/vehicles";

export const metadata: Metadata = { title: "Vehicle Management" };

export default async function VehiclesPage() {
  const user = await requireUser();
  if (!can(user, "view", { type: "cab" })) notFound();
  const today = isoDateIST();
  const [rows, stats, people, places] = await Promise.all([listCabBookings(user, today), cabStats(today), bookingPeople(), pickupSuggestions()]);
  return <VehiclesScreen rows={rows} stats={stats} people={people} places={places} me={user.id} today={today} defaultPickup={defaultPickupSlot()} />;
}
