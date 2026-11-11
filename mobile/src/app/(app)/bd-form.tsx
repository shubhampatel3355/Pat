import { MEETING_MODES, MEETING_TYPES, TEMPERATURES } from "@shared/constants";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { errorText } from "@/api/client";
import { runAction, useAction, useBd } from "@/api/queries";
import type { LeadTemperature, MeetingMode, MeetingType } from "@/api/prisma-enums";
import type { BdResponse, BdRow } from "@/api/types";
import { DateField, Field, Segmented, Select } from "@/components/ui/form";
import { ErrorState, Loading } from "@/components/ui/primitives";
import { FormScreen, Screen } from "@/components/ui/screen";
import { fieldErrors, param } from "@/lib/forms";

/**
 * Log or edit a BD meeting. Client phone and email are stored encrypted; people who can't see them may still
 * add them (a blank field leaves what is stored), exactly as on the web.
 */
export default function BdForm() {
  const params = useLocalSearchParams<{ id?: string }>();
  const q = useBd();
  if (q.isPending) return <Screen title="Meeting" back><Loading /></Screen>;
  if (!q.data) return <Screen title="Meeting" back><ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} /></Screen>;
  const id = param(params.id);
  const row = id ? q.data.rows.find((r) => r.id === id) : undefined;
  return <Form key={row?.id ?? "new"} data={q.data} row={row} />;
}

function Form({ data, row }: { data: BdResponse; row?: BdRow }) {
  const create = useAction("bd.create");
  const update = useAction("bd.update");
  const [date, setDate] = useState<string | null>(row?.date ?? data.today);
  const [tenantName, setTenantName] = useState(row?.tenantName ?? "");
  const [contactName, setContactName] = useState(row?.contactName ?? "");
  const [designation, setDesignation] = useState(row?.designation ?? "");
  const [phone, setPhone] = useState(row?.contact?.phone ?? "");
  const [email, setEmail] = useState(row?.contact?.email ?? "");
  const [meetingType, setMeetingType] = useState<MeetingType>(row?.meetingType ?? "INTRODUCTION");
  const [mode, setMode] = useState<MeetingMode>(row?.mode ?? "IN_PERSON");
  const [temperature, setTemperature] = useState<LeadTemperature>(row?.temperature ?? "WARM");
  const [primary, setPrimary] = useState(row?.primary.id ?? data.me);
  const [secondary, setSecondary] = useState<string>(row?.secondary?.id ?? "none");
  const [comments, setComments] = useState(row?.comments ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save() {
    // A blank contact field keeps what is stored, unless the person can see (and so clear) it.
    const contact = (value: string) => (value.trim() ? value : data.canSeeContacts && row ? "" : undefined);
    const fields = {
      primaryBrokerId: primary,
      secondaryBrokerId: secondary === "none" ? null : secondary,
      meetingDate: date ?? "",
      tenantName,
      contactName,
      designation,
      meetingType,
      mode,
      temperature,
      comments,
      phone: contact(phone),
      email: contact(email),
    };
    const res = row ? await runAction(update, { id: row.id, ...fields }) : await runAction(create, fields);
    if (res.ok) router.back();
    else setErrors(fieldErrors(res));
  }

  const people = data.users.map((u) => ({ value: u.id, label: u.name }));
  return (
    <FormScreen title={row ? "Edit meeting" : "Log a meeting"} onSubmit={save} saving={create.isPending || update.isPending}>
      <DateField label="Meeting date" value={date} onChange={setDate} error={errors.meetingDate} />
      <Field label="Tenant / company" value={tenantName} onChangeText={setTenantName} error={errors.tenantName} autoCapitalize="words" />
      <Field label="Contact person" value={contactName} onChangeText={setContactName} error={errors.contactName} autoCapitalize="words" />
      <Field label="Designation" value={designation} onChangeText={setDesignation} error={errors.designation} autoCapitalize="words" />
      <Field label="Phone" value={phone} onChangeText={setPhone} error={errors.phone} keyboardType="phone-pad" placeholder={row && !data.canSeeContacts ? "Hidden · type to replace" : "Optional"} autoComplete="tel" />
      <Field label="Email" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoCapitalize="none" placeholder={row && !data.canSeeContacts ? "Hidden · type to replace" : "Optional"} />
      <Select<MeetingType> label="Meeting type" value={meetingType} onChange={setMeetingType} options={MEETING_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
      <Segmented<MeetingMode> label="Mode" value={mode} onChange={setMode} options={MEETING_MODES.map((m) => ({ value: m.value, label: m.label }))} />
      <Segmented<LeadTemperature> label="Temperature" value={temperature} onChange={setTemperature} options={TEMPERATURES.map((t) => ({ value: t.value, label: t.label }))} />
      <Select label="Primary broker" value={primary} onChange={setPrimary} options={people} error={errors.primaryBrokerId} />
      <Select label="Secondary broker" value={secondary} onChange={setSecondary} options={[{ value: "none", label: "None" }, ...people.filter((p) => p.value !== primary)]} error={errors.secondaryBrokerId} />
      <Field label="Comments" value={comments} onChangeText={setComments} multiline error={errors.comments} />
    </FormScreen>
  );
}
