import { DUE_BUCKETS, DUE_LABEL, dateToBucket, type DueBucket } from "@shared/todo";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { errorText } from "@/api/client";
import { runAction, useAction, useDashboard } from "@/api/queries";
import type { TodoDto } from "@/api/types";
import { DateField, Field, Segmented, SwitchRow, TimeField } from "@/components/ui/form";
import { Button, Card, ErrorState, Loading } from "@/components/ui/primitives";
import { FormScreen, Screen } from "@/components/ui/screen";
import { fieldErrors, param } from "@/lib/forms";
import { useView } from "@/lib/view-store";

/** Personal to-dos from the dashboard card (Today / Tomorrow / This week / Next week / No date). */
export default function TodoForm() {
  const params = useLocalSearchParams<{ id?: string }>();
  const view = useView();
  const q = useDashboard(view);
  if (q.isPending) return <Screen title="To-do" back><Loading /></Screen>;
  if (!q.data) return <Screen title="To-do" back><ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} /></Screen>;
  const id = param(params.id);
  const todo = id ? q.data.data.todos.find((t) => t.id === id) : undefined;
  return todo ? <EditTodo todo={todo} today={q.data.data.today} /> : <NewTodo />;
}

function NewTodo() {
  const create = useAction("todos.create");
  const [text, setText] = useState("");
  const [due, setDue] = useState<DueBucket>("TODAY");
  const [time, setTime] = useState<string | null>(null);
  const [important, setImportant] = useState(false);
  const [remind, setRemind] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save() {
    const res = await runAction(create, { text, due, time: due === "NONE" ? null : time, important, remind: due !== "NONE" && remind });
    if (res.ok) router.back();
    else setErrors(fieldErrors(res));
  }

  return (
    <FormScreen title="New to-do" onSubmit={save} saving={create.isPending} submitLabel="Add">
      <Field label="To-do" value={text} onChangeText={setText} error={errors.text} placeholder="e.g. Call back Ritika about the LOI" />
      <Segmented<DueBucket> label="When" value={due} onChange={setDue} options={DUE_BUCKETS.map((b) => ({ value: b, label: DUE_LABEL[b] }))} />
      {due !== "NONE" ? <TimeField label="Time (optional)" value={time} onChange={setTime} error={errors.time} /> : null}
      <Card style={{ marginTop: 18, paddingVertical: 6 }}>
        <SwitchRow label="Important" value={important} onChange={setImportant} />
        <SwitchRow label="Remind me" sub={due === "NONE" ? "Pick a day first" : "In-app reminder at the due time"} value={remind && due !== "NONE"} onChange={setRemind} disabled={due === "NONE"} />
      </Card>
    </FormScreen>
  );
}

function EditTodo({ todo, today }: { todo: TodoDto; today: string }) {
  const update = useAction("todos.update");
  const remove = useAction("todos.delete");
  const [text, setText] = useState(todo.text);
  const [date, setDate] = useState<string | null>(todo.dueDate);
  const [time, setTime] = useState<string | null>(todo.dueTime);
  const [important, setImportant] = useState(todo.important);
  const [remind, setRemind] = useState(todo.remind);
  const [note, setNote] = useState(todo.note);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const bucket = dateToBucket(date, today);

  async function save() {
    const res = await runAction(update, { id: todo.id, patch: { text, dueDate: date, time: date ? time : null, important, remind: Boolean(date) && remind, note } });
    if (res.ok) router.back();
    else setErrors(fieldErrors(res, "patch."));
  }

  return (
    <FormScreen
      title="Edit to-do"
      sub={bucket ? DUE_LABEL[bucket] : date && date < today ? "Overdue" : undefined}
      onSubmit={save}
      saving={update.isPending}
      secondary={
        <Button
          label="Delete"
          kind="ghost"
          size="lg"
          onPress={() =>
            Alert.alert("Delete this to-do?", todo.text, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  const res = await runAction(remove, { id: todo.id });
                  if (res.ok) router.back();
                },
              },
            ])
          }
        />
      }
    >
      <Field label="To-do" value={text} onChangeText={setText} error={errors.text} />
      <DateField label="Due" value={date} onChange={setDate} clearable placeholder="No date" error={errors.dueDate} />
      {date ? <TimeField label="Time" value={time} day={date} onChange={setTime} error={errors.time} /> : null}
      <Field label="Note" value={note} onChangeText={setNote} multiline error={errors.note} />
      <Card style={{ marginTop: 18, paddingVertical: 6 }}>
        <SwitchRow label="Important" value={important} onChange={setImportant} />
        <SwitchRow label="Remind me" sub={date ? "In-app reminder at the due time" : "Pick a date first"} value={remind && Boolean(date)} onChange={setRemind} disabled={!date} />
      </Card>
    </FormScreen>
  );
}
