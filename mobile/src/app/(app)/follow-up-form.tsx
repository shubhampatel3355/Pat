import { FOLLOW_UP_TYPES } from "@shared/constants";
import { splitInstant } from "@shared/tasks";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { errorText } from "@/api/client";
import { runAction, useAction, useFollowUps } from "@/api/queries";
import type { FollowUpType } from "@/api/prisma-enums";
import type { FollowUpDto, FollowUpsResponse } from "@/api/types";
import { DateField, Field, Select, TimeField } from "@/components/ui/form";
import { ErrorState, Loading } from "@/components/ui/primitives";
import { FormScreen, Screen } from "@/components/ui/screen";
import { fieldErrors, param } from "@/lib/forms";

/** Schedule or edit a follow-up (the web's follow-up form). */
export default function FollowUpForm() {
  const params = useLocalSearchParams<{ id?: string; leadId?: string; contact?: string }>();
  const q = useFollowUps();
  if (q.isPending) return <Screen title="Follow-up" back><Loading /></Screen>;
  if (!q.data) return <Screen title="Follow-up" back><ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} /></Screen>;
  const id = param(params.id);
  const existing = id ? q.data.followUps.find((f) => f.id === id) : undefined;
  return <Form key={existing?.id ?? "new"} data={q.data} existing={existing} leadId={param(params.leadId)} contact={param(params.contact)} />;
}

function Form({ data, existing, leadId, contact }: { data: FollowUpsResponse; existing?: FollowUpDto; leadId?: string; contact?: string }) {
  const create = useAction("followUps.create");
  const update = useAction("followUps.update");
  const due = existing ? splitInstant(existing.dueAt) : null;
  const [contactName, setContactName] = useState(existing?.contactName ?? contact ?? "");
  const [type, setType] = useState<FollowUpType>(existing?.type ?? "CALL");
  const [lead, setLead] = useState<string>(existing?.lead?.id ?? leadId ?? "none");
  const [owner, setOwner] = useState(existing?.owner.id ?? data.me);
  const [date, setDate] = useState<string | null>(due?.date ?? data.today);
  const [time, setTime] = useState<string | null>(due?.time ?? "11:00");
  const [note, setNote] = useState(existing?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save() {
    const fields = { contactName, type, note, leadId: lead === "none" ? null : lead, ownerId: owner, dueDate: date ?? "", dueTime: time ?? "" };
    const res = existing ? await runAction(update, { id: existing.id, ...fields }) : await runAction(create, fields);
    if (res.ok) router.back();
    else setErrors(fieldErrors(res));
  }

  const leadOptions = [{ value: "none", label: "Not linked" }, ...data.leads.map((l) => ({ value: l.id, label: l.name }))];
  if (existing?.lead && !data.leads.some((l) => l.id === existing.lead!.id)) leadOptions.push({ value: existing.lead.id, label: existing.lead.name });
  return (
    <FormScreen title={existing ? "Edit follow-up" : "Schedule follow-up"} onSubmit={save} saving={create.isPending || update.isPending} submitLabel={existing ? "Save" : "Schedule"}>
      <Field label="Follow up with" value={contactName} onChangeText={setContactName} error={errors.contactName} placeholder="Person or company" autoCapitalize="words" />
      <Select<FollowUpType> label="Type" value={type} onChange={setType} options={FOLLOW_UP_TYPES.map((t) => ({ value: t.value, label: t.label }))} error={errors.type} />
      <Select label="WIP row" value={lead} onChange={setLead} options={leadOptions} error={errors.leadId} />
      <Select label="Owner" value={owner} onChange={setOwner} options={data.users.map((u) => ({ value: u.id, label: u.name }))} error={errors.ownerId} />
      <DateField label="Date" value={date} onChange={setDate} error={errors.dueDate} />
      <TimeField label="Time" value={time} day={date ?? undefined} onChange={setTime} error={errors.dueTime} />
      <Field label="Note" value={note} onChangeText={setNote} error={errors.note} multiline placeholder="What to discuss" />
    </FormScreen>
  );
}
