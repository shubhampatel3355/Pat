import { FOLLOW_UP_TYPES, TASK_PRIORITY } from "@shared/constants";
import { dueTone, followUpTab, instantLabel, rescheduleOptions } from "@shared/tasks";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { runAction, useAction } from "@/api/queries";
import type { FollowUpDto, TaskDto } from "@/api/types";
import { colors } from "@/theme/tokens";
import { DateField, TimeField } from "./ui/form";
import { Icon, type IconName } from "./ui/icon";
import { Button, IconWell, ListRow, Pill } from "./ui/primitives";
import { Sheet } from "./ui/sheet";
import { T } from "./ui/text";

const TYPE_ICON: Record<string, IconName> = { phone: "phone", whatsapp: "whatsapp", email: "mail", calendar: "calendar", visits: "building" };

export function followUpIcon(type: FollowUpDto["type"]): IconName {
  return TYPE_ICON[FOLLOW_UP_TYPES.find((t) => t.value === type)?.icon ?? "phone"] ?? "phone";
}

const TAB_COLOR = { OVERDUE: colors.danger, TODAY: colors.navy, UPCOMING: colors.muted } as const;
const TAB_LABEL = { OVERDUE: "Overdue", TODAY: "Today", UPCOMING: "Upcoming" } as const;

/** A follow-up with its actions (done, move, edit, delete) — the web's follow-up card. */
export function FollowUpItem({ f, now, today, first, showLead = true }: { f: FollowUpDto; now: string; today: string; first?: boolean; showLead?: boolean }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<{ date: string; time: string } | null>(null);
  const complete = useAction("followUps.complete");
  const reschedule = useAction("followUps.reschedule");
  const remove = useAction("followUps.delete");
  const tab = followUpTab(f.dueAt, now, today);
  const type = FOLLOW_UP_TYPES.find((t) => t.value === f.type)?.label ?? f.type;

  const move = async (date: string, time: string) => {
    const res = await runAction(reschedule, { id: f.id, dueDate: date, dueTime: time });
    if (res.ok) {
      setCustom(null);
      setOpen(false);
    }
  };

  return (
    <>
      <ListRow
        first={first}
        onPress={() => setOpen(true)}
        left={<IconWell name={followUpIcon(f.type)} size={40} color={tab === "OVERDUE" ? colors.danger : colors.text} />}
        title={f.contactName}
        sub={[type, showLead && f.lead ? f.lead.name : null, f.owner.name].filter(Boolean).join(" · ")}
        right={
          <View style={{ alignItems: "flex-end", gap: 4, maxWidth: 120 }}>
            <T variant="caption" color={TAB_COLOR[tab]} align="right" numberOfLines={2}>
              {instantLabel(f.dueAt, today)}
            </T>
          </View>
        }
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title={f.contactName} sub={`${type} · ${TAB_LABEL[tab]} · ${instantLabel(f.dueAt, today)}`}>
        {f.note ? (
          <T variant="body" style={{ marginBottom: 12 }}>
            {f.note}
          </T>
        ) : null}
        {f.lead ? (
          <Pressable
            onPress={() => {
              setOpen(false);
              router.push(`/lead/${f.lead!.id}`);
            }}
            style={styles.link}
          >
            <Icon name="building" size={18} color={colors.navy} />
            <T variant="strong" color={colors.navy}>
              {f.lead.name}
            </T>
          </Pressable>
        ) : null}
        {f.canEdit ? (
          <>
            <Button
              label="Mark done"
              icon="check"
              loading={complete.isPending}
              onPress={async () => {
                const res = await runAction(complete, { id: f.id });
                if (res.ok) setOpen(false);
              }}
            />
            <T variant="label" style={{ marginTop: 18, marginBottom: 8 }}>
              Move to
            </T>
            <View style={styles.moveRow}>
              {rescheduleOptions(now, today).map((o) => (
                <Button key={o.label} label={o.label} kind="secondary" size="sm" onPress={() => void move(o.date, o.time)} />
              ))}
              <Button label="Pick a time…" kind="ghost" size="sm" onPress={() => setCustom({ date: today, time: "11:00" })} />
            </View>
            {custom ? (
              <View>
                <DateField label="Date" value={custom.date} onChange={(d) => d && setCustom({ ...custom, date: d })} />
                <TimeField label="Time" value={custom.time} day={custom.date} onChange={(t) => setCustom({ ...custom, time: t })} />
                <Button label="Move" onPress={() => void move(custom.date, custom.time)} loading={reschedule.isPending} style={{ marginTop: 14 }} />
              </View>
            ) : null}
            <View style={[styles.moveRow, { marginTop: 18 }]}>
              <Button
                label="Edit"
                icon="edit"
                kind="secondary"
                size="sm"
                onPress={() => {
                  setOpen(false);
                  router.push({ pathname: "/follow-up-form", params: { id: f.id } });
                }}
              />
              <Button
                label="Delete"
                icon="trash"
                kind="ghost"
                size="sm"
                onPress={() =>
                  Alert.alert("Delete this follow-up?", `${f.contactName} · ${instantLabel(f.dueAt, today)}`, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        const res = await runAction(remove, { id: f.id });
                        if (res.ok) setOpen(false);
                      },
                    },
                  ])
                }
              />
            </View>
          </>
        ) : (
          <T variant="small">Only {f.owner.name} or a manager can change this follow-up.</T>
        )}
      </Sheet>
    </>
  );
}

/** A task: tick to complete, tap for details and comments. */
export function TaskItem({ t, now, today, first }: { t: TaskDto; now: string; today: string; first?: boolean }) {
  const setStatus = useAction("tasks.setStatus", { quiet: true });
  const done = t.status === "DONE";
  const tone = dueTone(t.dueAt, now, today, done);
  const priority = TASK_PRIORITY[t.priority];
  return (
    <ListRow
      first={first}
      onPress={() => router.push(`/task/${t.id}`)}
      leftAction={
        <Pressable
          disabled={!t.canEdit}
          onPress={() => void runAction(setStatus, { id: t.id, status: done ? "TODO" : "DONE" })}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done, disabled: !t.canEdit }}
          accessibilityLabel={t.title}
        >
          <Icon name={done ? "checkCircle" : "circle"} size={26} color={done ? colors.success : colors.muted} />
        </Pressable>
      }
      title={
        <T variant="strong" numberOfLines={2} style={done ? { textDecorationLine: "line-through", color: colors.muted } : undefined}>
          {t.title}
        </T>
      }
      sub={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          <Pill label={priority.label} color={priority.color} />
          {t.dueAt ? (
            <T variant="caption" color={tone === "overdue" ? colors.danger : tone === "today" ? colors.navy : colors.muted}>
              {instantLabel(t.dueAt, today)}
            </T>
          ) : null}
          <T variant="caption" numberOfLines={1}>
            · {t.assignee.name}
            {t.lead ? ` · ${t.lead.name}` : ""}
          </T>
        </View>
      }
      right={t.comments.length ? <Pill label={`${t.comments.length}`} color={colors.muted} /> : <Icon name="forward" size={18} color={colors.faint} />}
    />
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  moveRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
