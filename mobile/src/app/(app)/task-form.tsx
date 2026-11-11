import { TASK_PRIORITIES } from "@shared/constants";
import { DEFAULT_TASK_TIME, splitInstant } from "@shared/tasks";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { errorText } from "@/api/client";
import { runAction, useAction, useFollowUps } from "@/api/queries";
import type { TaskPriority } from "@/api/prisma-enums";
import type { FollowUpsResponse, TaskDto } from "@/api/types";
import { DateField, Field, Segmented, Select, SwitchRow, TimeField } from "@/components/ui/form";
import { Card, ErrorState, Loading } from "@/components/ui/primitives";
import { FormScreen, Screen } from "@/components/ui/screen";
import { fieldErrors, param } from "@/lib/forms";

/** Create or edit a task (the web's task form: assignee, due, priority, WIP link, reminders). */
export default function TaskForm() {
  const params = useLocalSearchParams<{ id?: string; leadId?: string }>();
  const q = useFollowUps();
  if (q.isPending) return <Screen title="Task" back><Loading /></Screen>;
  if (!q.data) return <Screen title="Task" back><ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} /></Screen>;
  const id = param(params.id);
  const existing = id ? q.data.tasks.find((t) => t.id === id) : undefined;
  return <Form key={existing?.id ?? "new"} data={q.data} existing={existing} leadId={param(params.leadId)} />;
}

function Form({ data, existing, leadId }: { data: FollowUpsResponse; existing?: TaskDto; leadId?: string }) {
  const create = useAction("tasks.create");
  const update = useAction("tasks.update");
  const due = existing ? splitInstant(existing.dueAt) : null;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [assignee, setAssignee] = useState(existing?.assignee.id ?? data.me);
  const [date, setDate] = useState<string | null>(existing ? (due?.date ?? null) : data.today);
  const [time, setTime] = useState<string | null>(existing ? (due?.time ?? null) : DEFAULT_TASK_TIME);
  const [priority, setPriority] = useState<TaskPriority>(existing?.priority ?? "MEDIUM");
  const [lead, setLead] = useState<string>(existing?.lead?.id ?? leadId ?? "none");
  const [inApp, setInApp] = useState(existing?.reminders.inApp ?? true);
  const [email, setEmail] = useState(existing?.reminders.email ?? false);
  const [whatsapp, setWhatsapp] = useState(existing?.reminders.whatsapp ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save() {
    const fields = {
      title,
      assigneeId: assignee,
      dueDate: date,
      dueTime: date ? (time ?? DEFAULT_TASK_TIME) : null,
      priority,
      leadId: lead === "none" ? null : lead,
      remindInApp: inApp,
      remindEmail: email,
      remindWhatsapp: whatsapp,
    };
    const res = existing ? await runAction(update, { id: existing.id, ...fields }) : await runAction(create, fields);
    if (res.ok) router.back();
    else setErrors(fieldErrors(res));
  }

  const leadOptions = [{ value: "none", label: "Not linked" }, ...data.leads.map((l) => ({ value: l.id, label: l.name }))];
  return (
    <FormScreen title={existing ? "Edit task" : "New task"} onSubmit={save} saving={create.isPending || update.isPending} submitLabel={existing ? "Save" : "Add task"}>
      <Field label="Task" value={title} onChangeText={setTitle} error={errors.title} placeholder="e.g. Send the revised floor plan" />
      <Select label="Assign to" value={assignee} onChange={setAssignee} options={data.users.map((u) => ({ value: u.id, label: u.id === data.me ? `${u.name} (me)` : u.name }))} error={errors.assigneeId} />
      <DateField label="Due" value={date} onChange={setDate} error={errors.dueDate} clearable placeholder="No due date" />
      {date ? <TimeField label="Time" value={time} day={date} onChange={setTime} error={errors.dueTime} /> : null}
      <Segmented<TaskPriority> label="Priority" value={priority} onChange={setPriority} options={TASK_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
      <Select label="WIP row" value={lead} onChange={setLead} options={leadOptions} error={errors.leadId} />
      <Card style={{ marginTop: 18, paddingVertical: 6 }}>
        <View>
          <SwitchRow label="In-app reminder" value={inApp} onChange={setInApp} />
          <SwitchRow label="Email reminder" value={email} onChange={setEmail} />
          <SwitchRow label="WhatsApp reminder" sub="Sent once WhatsApp is connected" value={whatsapp} onChange={setWhatsapp} />
        </View>
      </Card>
    </FormScreen>
  );
}
