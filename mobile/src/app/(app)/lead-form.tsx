import { WIP_REMARKS } from "@shared/constants";
import { estimatedFeesPaise, monthlyRentPaise } from "@shared/wip";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { runAction, useAction, useWip } from "@/api/queries";
import type { LandlordType, PricingBasis, WipRemark } from "@/api/prisma-enums";
import { AmountField, DateField, Field, MultiSelect, NumberField, Segmented, Select } from "@/components/ui/form";
import { Card, ErrorState, Loading } from "@/components/ui/primitives";
import { FormScreen, Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";
import { errorText } from "@/api/client";
import { fieldErrors, intOrNull, param } from "@/lib/forms";
import { formatINR, paiseToInput, parseRupeesToPaise } from "@/lib/format";

const BASIS: { value: PricingBasis; label: string }[] = [
  { value: "PER_SQFT", label: "Per sq ft" },
  { value: "PER_SEAT", label: "Per seat" },
  { value: "LUMPSUM", label: "Lumpsum" },
];

/** New WIP entry or edit (the web's WIP form and rules: the creator must be a broker unless they can edit all). */
export default function LeadForm() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = param(params.id);
  const wip = useWip();
  if (wip.isPending) return <Screen title="WIP" back><Loading /></Screen>;
  if (wip.isError || !wip.data) return <Screen title="WIP" back><ErrorState message={errorText(wip.error)} onRetry={() => void wip.refetch()} /></Screen>;
  const row = id ? wip.data.rows.find((r) => r.id === id) : undefined;
  return <Form key={row?.id ?? "new"} data={wip.data} row={row} />;
}

function Form({ data, row }: { data: NonNullable<ReturnType<typeof useWip>["data"]>; row?: NonNullable<ReturnType<typeof useWip>["data"]>["rows"][number] }) {
  const create = useAction<unknown, { id: string }>("wip.create");
  const update = useAction("wip.update");
  const [tenantName, setTenantName] = useState(row?.tenantName ?? "");
  const [landlordType, setLandlordType] = useState<LandlordType>(row?.landlordType ?? "LANDLORD");
  const [landlordName, setLandlordName] = useState(row?.landlordName ?? "");
  const [basis, setBasis] = useState<PricingBasis>(row?.pricingBasis ?? "PER_SQFT");
  const [area, setArea] = useState(row?.areaSqft ? String(row.areaSqft) : "");
  const [seats, setSeats] = useState(row?.seats ? String(row.seats) : "");
  const [rate, setRate] = useState(row ? paiseToInput(row.ratePaise) : "");
  const [building, setBuilding] = useState(row?.building ?? "");
  const [location, setLocation] = useState(row?.location ?? "");
  const [primary, setPrimary] = useState<string[]>(row ? row.primary.flatMap((b) => (b.userId ? [b.userId] : [])) : [data.me]);
  const [secondary, setSecondary] = useState<string[]>(row ? row.secondary.flatMap((b) => (b.userId ? [b.userId] : [])) : []);
  const [external, setExternal] = useState(row ? row.secondary.filter((b) => !b.userId).map((b) => b.name).join(", ") : "");
  const [closure, setClosure] = useState<string | null>(row?.closureDate ?? data.defaultClosure);
  const [remark, setRemark] = useState<WipRemark>(row?.remark ?? "VISITS");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const userOptions = data.users.map((u) => ({ value: u.id, label: u.name }));
  const ratePaise = parseRupeesToPaise(rate) ?? 0;
  const areaSqft = basis === "PER_SQFT" ? intOrNull(area) : null;
  const seatCount = basis === "PER_SEAT" ? intOrNull(seats) : null;
  const rent = monthlyRentPaise(basis, ratePaise, areaSqft, seatCount);
  const fees = estimatedFeesPaise(basis, ratePaise, areaSqft, seatCount);

  async function save() {
    const input = {
      tenantName,
      landlordType,
      landlordName,
      pricingBasis: basis,
      areaSqft,
      seats: seatCount,
      ratePaise,
      building,
      location,
      primaryBrokerIds: primary,
      secondaryBrokers: [
        ...secondary.filter((s) => !primary.includes(s)).map((userId) => ({ userId })),
        ...external
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((externalName) => ({ externalName })),
      ],
      closureDate: closure ?? "",
      remark,
    };
    const res = row ? await runAction(update, { id: row.id, data: input }) : await runAction(create, input);
    if (res.ok) router.back();
    else setErrors(fieldErrors(res, row ? "data." : ""));
  }

  const rateLabel = basis === "PER_SQFT" ? "Rent per sq ft" : basis === "PER_SEAT" ? "Rent per seat" : "Monthly rent (lumpsum)";
  return (
    <FormScreen title={row ? "Edit WIP entry" : "New WIP entry"} sub={row ? row.tenantName : undefined} onSubmit={save} saving={create.isPending || update.isPending} submitLabel={row ? "Save changes" : "Add to WIP"}>
      <Field label="Tenant name" value={tenantName} onChangeText={setTenantName} placeholder="e.g. Orbit Logistics" error={errors.tenantName} autoCapitalize="words" />
      <Segmented label="Space from" value={landlordType} onChange={setLandlordType} options={[{ value: "LANDLORD", label: "Landlord" }, { value: "OPERATOR", label: "Operator" }]} />
      <Field label={landlordType === "OPERATOR" ? "Operator name" : "Landlord name"} value={landlordName} onChangeText={setLandlordName} error={errors.landlordName} autoCapitalize="words" />
      <Segmented label="Pricing" value={basis} onChange={setBasis} options={BASIS} />
      {basis === "PER_SQFT" ? <NumberField label="Area (sq ft)" value={area} onChange={setArea} error={errors.areaSqft} placeholder="e.g. 12,500" /> : null}
      {basis === "PER_SEAT" ? <NumberField label="Seats" value={seats} onChange={setSeats} error={errors.seats} placeholder="e.g. 60" /> : null}
      <AmountField label={rateLabel} value={rate} onChange={setRate} error={errors.ratePaise} />
      <Card style={{ marginTop: 14 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T variant="caption">Monthly rent</T>
            <T variant="strong">{formatINR(rent)}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="caption">Estimated fees</T>
            <T variant="strong">{formatINR(fees)}</T>
          </View>
        </View>
      </Card>
      <Field label="Building" value={building} onChangeText={setBuilding} error={errors.building} placeholder="e.g. Prestige Tech Park" autoCapitalize="words" />
      <Field label="Location" value={location} onChangeText={setLocation} error={errors.location} placeholder="e.g. Marathahalli, ORR" autoCapitalize="words" />
      <MultiSelect label="Primary brokers" values={primary} options={userOptions} onChange={setPrimary} error={errors.primaryBrokerIds} max={5} />
      <MultiSelect label="Secondary brokers (team)" values={secondary} options={userOptions.filter((u) => !primary.includes(u.value))} onChange={setSecondary} error={errors.secondaryBrokers} max={8} placeholder="None" />
      <Field label="Outside brokers" value={external} onChangeText={setExternal} placeholder="Names, separated by commas" autoCapitalize="words" />
      <DateField label="Expected closure" value={closure} onChange={setClosure} error={errors.closureDate} />
      <Select<WipRemark> label="Stage" value={remark} onChange={setRemark} options={WIP_REMARKS.map((r) => ({ value: r.value, label: r.label, color: r.color }))} error={errors.remark} />
    </FormScreen>
  );
}
