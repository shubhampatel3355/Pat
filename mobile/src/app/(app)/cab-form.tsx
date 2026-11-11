import { CAR_TYPES } from "@shared/constants";
import { router } from "expo-router";
import { useState } from "react";
import { errorText } from "@/api/client";
import { runAction, useAction, useVehicles } from "@/api/queries";
import type { CarType } from "@/api/prisma-enums";
import type { VehiclesResponse } from "@/api/types";
import { DateField, Field, Segmented, Select, TimeField } from "@/components/ui/form";
import { Chip, ChipRow, ErrorState, Loading } from "@/components/ui/primitives";
import { FormScreen, Screen } from "@/components/ui/screen";
import { fieldErrors } from "@/lib/forms";

/** Book a cab (the web's booking form, with its default pick-up slot and suggested places). */
export default function CabForm() {
  const q = useVehicles();
  if (q.isPending) return <Screen title="Book a cab" back><Loading /></Screen>;
  if (!q.data) return <Screen title="Book a cab" back><ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} /></Screen>;
  return <Form data={q.data} />;
}

function Form({ data }: { data: VehiclesResponse }) {
  const book = useAction("cabs.book");
  const [carType, setCarType] = useState<CarType>("SEDAN");
  const [clientName, setClientName] = useState("");
  const [date, setDate] = useState<string | null>(data.defaultPickup.date);
  const [time, setTime] = useState<string | null>(data.defaultPickup.time);
  const [place, setPlace] = useState("");
  const [bookedFor, setBookedFor] = useState(data.me);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save() {
    const res = await runAction(book, { carType, clientName, pickupDate: date ?? "", pickupTime: time ?? "", pickupLocation: place, bookedForId: bookedFor });
    if (res.ok) router.back();
    else setErrors(fieldErrors(res));
  }

  return (
    <FormScreen title="Book a cab" onSubmit={save} saving={book.isPending} submitLabel="Request cab">
      <Segmented<CarType> label="Car" value={carType} onChange={setCarType} options={CAR_TYPES.map((c) => ({ value: c.value, label: `${c.label} · ${c.seats}` }))} />
      <Field label="Client" value={clientName} onChangeText={setClientName} error={errors.clientName} autoCapitalize="words" placeholder="Who the trip is for" />
      <DateField label="Pick-up date" value={date} onChange={setDate} error={errors.pickupDate} />
      <TimeField label="Pick-up time" value={time} day={date ?? undefined} onChange={setTime} error={errors.pickupTime} />
      <Field label="Pick-up location" value={place} onChangeText={setPlace} error={errors.pickupLocation} placeholder="Address or landmark" />
      <ChipRow style={{ paddingHorizontal: 0, marginTop: 10 }}>
        {data.places.map((p) => (
          <Chip key={p} label={p} small active={place === p} onPress={() => setPlace(p)} />
        ))}
      </ChipRow>
      <Select label="Booked for" value={bookedFor} onChange={setBookedFor} options={data.people.map((p) => ({ value: p.id, label: p.label }))} error={errors.bookedForId} />
    </FormScreen>
  );
}
