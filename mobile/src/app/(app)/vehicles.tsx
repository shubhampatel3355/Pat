import { CAB_STATUS, CAR_TYPES } from "@shared/constants";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { errorText } from "@/api/client";
import { runAction, useAction, useVehicles } from "@/api/queries";
import type { CabStatus } from "@/api/prisma-enums";
import type { CabRow } from "@/api/types";
import { Fab } from "@/components/fab";
import { Avatar, Button, Card, Chip, ChipRow, EmptyState, ErrorState, Loading, Pill, StatGrid } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";
import { formatTime12, relativeDayLabel } from "@/lib/format";

/** Vehicle Management: cab bookings (the web's /vehicles). Anyone can book; managers confirm and complete. */
export default function Vehicles() {
  const q = useVehicles();
  const [status, setStatus] = useState<CabStatus | "ALL">("ALL");
  const d = q.data;
  const rows = (d?.rows ?? []).filter((r) => status === "ALL" || r.status === status);
  return (
    <>
      <Screen title="Vehicle Management" back query={q} sub="Cab requests">
        {d ? (
          <View style={{ marginTop: 16 }}>
            <StatGrid
              items={[
                { value: String(d.stats.today), label: "Today" },
                { value: String(d.stats.upcoming), label: "Upcoming" },
                { value: String(d.stats.all), label: "All bookings" },
              ]}
            />
          </View>
        ) : null}
        <ChipRow style={{ paddingHorizontal: 0, marginTop: 14 }}>
          <Chip label="All" active={status === "ALL"} onPress={() => setStatus("ALL")} />
          {(["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED"] as const).map((s) => (
            <Chip key={s} label={CAB_STATUS[s].label} active={status === s} onPress={() => setStatus(s)} count={d?.rows.filter((r) => r.status === s).length} />
          ))}
        </ChipRow>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />
        ) : rows.length ? (
          <View style={{ gap: 12, marginTop: 16 }}>
            {rows.map((r) => (
              <Booking key={r.id} r={r} today={d!.today} />
            ))}
          </View>
        ) : (
          <EmptyState icon="car" title="No bookings" text="Book a cab for a site visit or a client pick-up." action="Book a cab" onAction={() => router.push("/cab-form")} />
        )}
      </Screen>
      <Fab label="Book a cab" overTabs={false} onPress={() => router.push("/cab-form")} />
    </>
  );
}

function Booking({ r, today }: { r: CabRow; today: string }) {
  const setStatus = useAction("cabs.setStatus");
  const status = CAB_STATUS[r.status];
  const car = CAR_TYPES.find((c) => c.value === r.carType);
  const change = (next: "CONFIRMED" | "COMPLETED" | "CANCELLED") => void runAction(setStatus, { id: r.id, status: next });
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar initials={r.bookedFor.initials} name={r.bookedFor.name} size={42} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T variant="strong" numberOfLines={1}>
            {r.bookedFor.name} · {car?.label ?? r.carType}
          </T>
          <T variant="caption" numberOfLines={1}>
            {r.bookedFor.role}
          </T>
        </View>
        <Pill label={status.label} color={status.color} />
      </View>
      <T variant="body" style={{ marginTop: 12 }}>
        {relativeDayLabel(r.date, today)}, {formatTime12(r.time)} · {r.pickupLocation}
      </T>
      <T variant="small" style={{ marginTop: 4 }}>
        Client: {r.clientName} · booked {r.bookedOn}
      </T>
      {r.canConfirm || r.canComplete || r.canCancel ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          {r.canConfirm ? <Button label="Confirm" size="sm" style={{ flex: 1 }} onPress={() => change("CONFIRMED")} /> : null}
          {r.canComplete ? <Button label="Complete" size="sm" style={{ flex: 1 }} onPress={() => change("COMPLETED")} /> : null}
          {r.canCancel ? (
            <Button
              label="Cancel"
              size="sm"
              kind="ghost"
              style={{ flex: 1 }}
              onPress={() =>
                Alert.alert("Cancel this booking?", `${r.bookedFor.name} · ${relativeDayLabel(r.date, today)}, ${formatTime12(r.time)}`, [
                  { text: "Keep", style: "cancel" },
                  { text: "Cancel booking", style: "destructive", onPress: () => change("CANCELLED") },
                ])
              }
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
