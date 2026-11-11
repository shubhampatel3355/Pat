import { TASK_PRIORITY, TASK_STATUSES } from "@shared/constants";
import { instantLabel } from "@shared/tasks";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { errorText } from "@/api/client";
import { runAction, useAction, useFollowUps } from "@/api/queries";
import type { TaskStatus } from "@/api/prisma-enums";
import { Field, Segmented, SwitchRow } from "@/components/ui/form";
import { Avatar, Button, Card, EmptyState, ErrorState, KeyValue, ListCard, ListRow, Loading, Pill, Section } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";
import { ago } from "@/lib/format";

/** A task: status, reminders, comments (the web's task drawer). */
export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useFollowUps();
  const setStatus = useAction("tasks.setStatus");
  const setReminders = useAction("tasks.setReminders", { quiet: true });
  const comment = useAction("tasks.comment", { quiet: true });
  const remove = useAction("tasks.delete");
  const [body, setBody] = useState("");

  if (q.isPending) return <Screen title="Task" back><Loading /></Screen>;
  if (q.isError) return <Screen title="Task" back><ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} /></Screen>;
  const t = q.data.tasks.find((x) => x.id === id);
  if (!t) return <Screen title="Task" back><EmptyState icon="checkCircle" title="Not found" text="This task was deleted, or finished more than two weeks ago." /></Screen>;
  const priority = TASK_PRIORITY[t.priority];

  const reminders = (patch: Partial<typeof t.reminders>) => {
    const next = { ...t.reminders, ...patch };
    void runAction(setReminders, { id: t.id, remindInApp: next.inApp, remindEmail: next.email, remindWhatsapp: next.whatsapp });
  };

  return (
    <Screen
      title="Task"
      back
      query={q}
      right={t.canEdit ? <Button label="Edit" kind="secondary" size="sm" icon="edit" onPress={() => router.push({ pathname: "/task-form", params: { id: t.id } })} /> : undefined}
    >
      <T variant="h1" style={{ marginTop: 16 }}>
        {t.title}
      </T>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Pill label={priority.label} color={priority.color} />
        {t.dueAt ? <Pill label={instantLabel(t.dueAt, q.data.today)} color="#55555A" /> : null}
      </View>

      {t.canEdit ? (
        <View style={{ marginTop: 18 }}>
          <Segmented<TaskStatus> value={t.status} onChange={(status) => void runAction(setStatus, { id: t.id, status })} options={TASK_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
        </View>
      ) : null}

      <Section title="Details">
        <ListCard>
          <KeyValue first k="Assigned to" v={t.assignee.name} />
          <KeyValue k="Created by" v={t.createdBy} />
          <KeyValue k="Due" v={t.dueAt ? instantLabel(t.dueAt, q.data.today) : "No due date"} />
          {t.lead ? (
            <ListRow title={t.lead.name} sub="WIP row" onPress={() => router.push(`/lead/${t.lead!.id}`)} right={<Pill label="Open" color="#023E7D" />} />
          ) : null}
        </ListCard>
      </Section>

      <Section title="Reminders">
        <Card style={{ paddingVertical: 6 }}>
          <SwitchRow label="In the app" value={t.reminders.inApp} onChange={(v) => reminders({ inApp: v })} disabled={!t.canEdit} />
          <SwitchRow label="Email" value={t.reminders.email} onChange={(v) => reminders({ email: v })} disabled={!t.canEdit} />
          <SwitchRow label="WhatsApp" value={t.reminders.whatsapp} onChange={(v) => reminders({ whatsapp: v })} disabled={!t.canEdit} />
        </Card>
      </Section>

      <Section title={`Comments · ${t.comments.length}`}>
        {t.comments.length ? (
          <ListCard>
            {t.comments.map((c, i) => (
              <ListRow key={c.id} first={i === 0} left={<Avatar initials={c.author.initials} name={c.author.name} size={36} />} title={c.body} numberOfLines={6} sub={`${c.author.name} · ${ago(c.at)}`} />
            ))}
          </ListCard>
        ) : null}
        <Field value={body} onChangeText={setBody} placeholder="Write a comment" multiline />
        <Button
          label="Comment"
          icon="send"
          kind="secondary"
          loading={comment.isPending}
          style={{ marginTop: 10 }}
          onPress={async () => {
            const res = await runAction(comment, { taskId: t.id, body });
            if (res.ok) setBody("");
          }}
        />
      </Section>

      {t.canDelete ? (
        <Button
          label="Delete task"
          icon="trash"
          kind="ghost"
          style={{ marginTop: 26 }}
          onPress={() =>
            Alert.alert("Delete this task?", t.title, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  const res = await runAction(remove, { id: t.id });
                  if (res.ok) router.back();
                },
              },
            ])
          }
        />
      ) : null}
    </Screen>
  );
}
