import { TASK_STATUSES } from "@shared/constants";
import { followUpTab, type FollowUpTab } from "@shared/tasks";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { errorText } from "@/api/client";
import { useFollowUps } from "@/api/queries";
import { Fab } from "@/components/fab";
import { TopActions } from "@/components/top-actions";
import { FollowUpItem, TaskItem } from "@/components/work-items";
import { Chip, ChipRow, EmptyState, ErrorState, ListCard, Loading, Section } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { ChoiceSheet } from "@/components/ui/sheet";
import { Segmented } from "@/components/ui/form";

const EMPTY: Record<FollowUpTab, [string, string]> = {
  OVERDUE: ["Nothing overdue", "You are all caught up. Nice work."],
  TODAY: ["Nothing due today", "Check Upcoming for what is next."],
  UPCOMING: ["Nothing upcoming", "Schedule a follow-up from any WIP row."],
};

/** Follow-ups & Tasks (the web's /follow-ups). */
export default function FollowUps() {
  const q = useFollowUps();
  const [mode, setMode] = useState<"followups" | "tasks">("followups");
  const [tab, setTab] = useState<FollowUpTab>("TODAY");
  const [mine, setMine] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const d = q.data;

  const byTab = (t: FollowUpTab) => (d ? d.followUps.filter((f) => followUpTab(f.dueAt, d.now, d.today) === t) : []);
  const visibleFollowUps = byTab(tab).filter((f) => !mine || f.owner.id === d?.me);
  const tasks = (d?.tasks ?? []).filter((t) => !mine || t.assignee.id === d?.me);

  return (
    <>
      <Screen tabs query={q} title="Follow-ups" sub="Follow-ups & tasks" right={<TopActions />}>
        <View style={{ marginTop: 14 }}>
          <Segmented value={mode} onChange={setMode} options={[{ value: "followups", label: `Follow-ups${d ? ` · ${d.followUps.length}` : ""}` }, { value: "tasks", label: `Tasks${d ? ` · ${d.tasks.filter((t) => t.status !== "DONE").length}` : ""}` }]} />
        </View>
        <ChipRow style={{ paddingHorizontal: 0, marginTop: 12 }}>
          {mode === "followups"
            ? (["OVERDUE", "TODAY", "UPCOMING"] as const).map((t) => <Chip key={t} label={t === "OVERDUE" ? "Overdue" : t === "TODAY" ? "Today" : "Upcoming"} active={tab === t} onPress={() => setTab(t)} count={byTab(t).length} />)
            : null}
          <Chip label="Only mine" active={mine} onPress={() => setMine((m) => !m)} />
        </ChipRow>

        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />
        ) : !d ? null : mode === "followups" ? (
          visibleFollowUps.length ? (
            <ListCard style={{ marginTop: 16 }}>
              {visibleFollowUps.map((f, i) => (
                <FollowUpItem key={f.id} f={f} now={d.now} today={d.today} first={i === 0} />
              ))}
            </ListCard>
          ) : (
            <EmptyState icon="calendarCheck" title={EMPTY[tab][0]} text={EMPTY[tab][1]} />
          )
        ) : tasks.length ? (
          TASK_STATUSES.map((s) => {
            const list = tasks.filter((t) => t.status === s.value);
            if (!list.length) return null;
            return (
              <Section key={s.value} title={`${s.label} · ${list.length}`}>
                <ListCard>
                  {list.map((t, i) => (
                    <TaskItem key={t.id} t={t} now={d.now} today={d.today} first={i === 0} />
                  ))}
                </ListCard>
              </Section>
            );
          })
        ) : (
          <EmptyState icon="checkCircle" title="No tasks" text="Tasks you are given or create show up here." />
        )}
      </Screen>
      <Fab label="Add" onPress={() => setAddOpen(true)} />
      <ChoiceSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add"
        options={[
          { value: "followup", label: "Follow-up", sub: "Call, WhatsApp, email, meeting or site visit" },
          { value: "task", label: "Task", sub: "Something to do, for you or a colleague" },
        ]}
        onSelect={(v) => router.push(v === "task" ? "/task-form" : "/follow-up-form")}
      />
    </>
  );
}
