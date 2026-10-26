"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import { FOLLOW_UP_TYPES, TASK_PRIORITIES, TASK_PRIORITY, TASK_STATUS, TASK_STATUSES } from "@/lib/constants";
import { addDaysIso, formatTime12, isoDateIST, isoToDate, timeIST } from "@/lib/dates";
import { DUE_TONE_STYLE, dueTone, followUpTab, instantLabel, rescheduleOptions, type FollowUpTab } from "@/lib/tasks";
import { completeFollowUpAction, rescheduleFollowUpAction, setTaskStatusAction } from "@/server/actions/tasks";
import type { FollowUpDto, LeadOption, TaskDto } from "@/server/services/tasks";
import type { UserOption } from "@/server/services/wip";
import { Avatar, EmptyState, StatusPill } from "../ui/bits";
import { Button, IconButton } from "../ui/button";
import { CheckGlyph, Icon } from "../ui/icon";
import { Page, PageHeader } from "../ui/page";
import { Cell, HeadCell, Row, RowHead, RowTable } from "../ui/row-table";
import { ChoiceChips, Segmented } from "../ui/segmented";
import { useAction } from "../ui/toast";
import { FollowUpModal } from "./followup-modal";
import { TaskDrawer } from "./task-drawer";
import { TaskModal } from "./task-modal";

type Mode = "followups" | "tasks";
const TYPE = Object.fromEntries(FOLLOW_UP_TYPES.map((t) => [t.value, t]));
const TASK_COLUMNS = "28px minmax(240px,2fr) minmax(140px,1fr) 40px 150px 100px 110px";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface FollowUpsScreenProps {
  followUps: FollowUpDto[];
  tasks: TaskDto[];
  users: UserOption[];
  leads: LeadOption[];
  me: string;
  today: string;
  now: string;
}

function DuePill({ at, now, today, done, className }: { at: string | null; now: string; today: string; done?: boolean; className?: string }) {
  const tone = dueTone(at, now, today, done);
  const style = DUE_TONE_STYLE[tone];
  return (
    <span className={`inline-flex h-6 items-center justify-self-start whitespace-nowrap rounded-pill px-2.5 text-[11px] font-medium ${className ?? ""}`} style={{ background: style.bg, color: style.fg }}>
      {at ? instantLabel(at, today) : "No date"}
    </span>
  );
}

function CompleteCircle({ done, onClick, label, size = 28 }: { done: boolean; onClick: (e: React.MouseEvent) => void; label: string; size?: number }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={done}
      onClick={onClick}
      className="hit-44 flex flex-none items-center justify-center rounded-pill border-[1.5px] p-0 transition-colors duration-200 hover:border-primary"
      style={{ width: size, height: size, borderColor: done ? "#023E7D" : "#A8A8AD", background: done ? "#023E7D" : "transparent" }}
    >
      {done && <CheckGlyph />}
    </button>
  );
}

export function FollowUpsScreen({ followUps, tasks, users, leads, me, today, now }: FollowUpsScreenProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(() => (params.get("mode") === "tasks" || params.has("task") || params.get("new") === "task" ? "tasks" : "followups"));
  const [tab, setTab] = useState<FollowUpTab>("TODAY");
  const [fuView, setFuView] = useState<"agenda" | "week">("agenda");
  const [taskView, setTaskView] = useState<"list" | "board">("list");
  const [prio, setPrio] = useState<TaskPriority | "ALL">("ALL");
  const [taskModal, setTaskModal] = useState<{ open: boolean; task: TaskDto | null }>(() => ({ open: params.get("new") === "task", task: null }));
  const [followUpModal, setFollowUpModal] = useState<{ open: boolean; followUp: FollowUpDto | null }>(() => ({
    open: params.get("new") === "followup" || (params.has("followup") && followUps.some((f) => f.id === params.get("followup") && f.canEdit)),
    followUp: followUps.find((f) => f.id === params.get("followup")) ?? null,
  }));
  const [drawerId, setDrawerId] = useState<string | null>(() => params.get("task"));
  const [resched, setResched] = useState<string | null>(null);
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, TaskStatus>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  // Optimistic marks are dropped whenever fresh data arrives from the server.
  const [seen, setSeen] = useState({ followUps, tasks });
  if (seen.followUps !== followUps || seen.tasks !== tasks) {
    setSeen({ followUps, tasks });
    setDone(new Set());
    setOverrides({});
  }

  useEffect(() => {
    if (params.has("new") || params.has("task") || params.has("followup") || params.has("mode")) router.replace("/follow-ups", { scroll: false });
  }, [params, router]);

  const complete = useAction(completeFollowUpAction);
  const reschedule = useAction(rescheduleFollowUpAction, { onSuccess: () => setResched(null) });
  const taskStatus = useAction(setTaskStatusAction);

  const withTab = useMemo(() => followUps.map((f) => ({ ...f, tab: followUpTab(f.dueAt, now, today) })), [followUps, now, today]);
  const counts = { TODAY: 0, OVERDUE: 0, UPCOMING: 0 } as Record<FollowUpTab, number>;
  for (const f of withTab) counts[f.tab] += 1;
  const tabRows = withTab.filter((f) => f.tab === tab);
  const visibleTasks = tasks.map((t) => (overrides[t.id] ? { ...t, status: overrides[t.id]! } : t)).filter((t) => prio === "ALL" || t.priority === prio);
  const openTasks = tasks.filter((t) => (overrides[t.id] ?? t.status) !== "DONE").length;
  const drawerTask = drawerId ? tasks.find((t) => t.id === drawerId) : undefined;
  const options = rescheduleOptions(now, today);

  const setStatus = (t: TaskDto, status: TaskStatus) => {
    if (!t.canEdit || (overrides[t.id] ?? t.status) === status) return;
    setOverrides((o) => ({ ...o, [t.id]: status }));
    void taskStatus.run({ id: t.id, status });
  };
  const completeFollowUp = (f: FollowUpDto) => {
    if (!f.canEdit || done.has(f.id)) return;
    setDone((s) => new Set(s).add(f.id));
    void complete.run({ id: f.id });
  };

  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDaysIso(today, i - 1);
    const items = withTab.filter((f) => isoDateIST(new Date(f.dueAt)) === day);
    const dow = DAYS[isoToDate(day).getUTCDay()];
    return { day, label: day === today ? `Today ${Number(day.slice(8))}` : `${dow} ${Number(day.slice(8))}`, items };
  });

  return (
    <Page>
      <PageHeader
        title="Follow-ups & Tasks"
        meta={`${counts.TODAY} due today · ${counts.OVERDUE} overdue · ${openTasks} open task${openTasks === 1 ? "" : "s"}`}
        actions={
          <>
            <Segmented<Mode>
              label="Show"
              size="sm"
              options={[
                { value: "followups", label: "Follow-ups" },
                { value: "tasks", label: "Tasks" },
              ]}
              value={mode}
              onChange={setMode}
            />
            {mode === "followups" ? (
              <Button onClick={() => setFollowUpModal({ open: true, followUp: null })}>+ New follow-up</Button>
            ) : (
              <Button onClick={() => setTaskModal({ open: true, task: null })}>+ New task</Button>
            )}
          </>
        }
      />

      {mode === "followups" ? (
        <>
          <div className="flex flex-wrap justify-between gap-2">
            <Segmented<FollowUpTab>
              label="Follow-ups due"
              size="sm"
              options={(["TODAY", "OVERDUE", "UPCOMING"] as const).map((k) => ({
                value: k,
                label: (
                  <span className="flex items-center gap-1.5">
                    {k === "TODAY" ? "Today" : k === "OVERDUE" ? "Overdue" : "Upcoming"}
                    <span className={`text-[11px] font-normal ${k === "OVERDUE" ? "text-navy-950" : "text-muted"}`}>{counts[k]}</span>
                  </span>
                ),
              }))}
              value={tab}
              onChange={(v) => {
                setTab(v);
                setResched(null);
              }}
            />
            <Segmented
              label="Follow-up view"
              size="sm"
              options={[
                { value: "agenda", label: "Agenda" },
                { value: "week", label: "Week" },
              ]}
              value={fuView}
              onChange={setFuView}
            />
          </div>

          {fuView === "agenda" ? (
            <div className="flex flex-col gap-1 rounded-card bg-card p-2" role="list" aria-label="Follow-ups">
              {tabRows.map((f) => {
                const isDone = done.has(f.id);
                const type = TYPE[f.type]!;
                return (
                  <div key={f.id} role="listitem" className="flex flex-col gap-1.5 rounded-row bg-surface px-3 py-2 transition-opacity duration-300" style={{ opacity: isDone ? 0.5 : 1 }}>
                    <div className="flex min-h-10 items-center gap-3">
                      <CompleteCircle done={isDone} label={`Complete follow-up with ${f.contactName}`} onClick={() => completeFollowUp(f)} />
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-chip-2">
                        <Icon name={type.icon} size={15} />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        {f.canEdit ? (
                          <button type="button" onClick={() => setFollowUpModal({ open: true, followUp: f })} className="self-start border-0 bg-transparent p-0 text-left text-sm text-ink hover:text-primary" style={{ textDecoration: isDone ? "line-through" : "none" }}>
                            {f.contactName}
                          </button>
                        ) : (
                          <span className="text-sm">{f.contactName}</span>
                        )}
                        <span className="truncate text-[11px] text-muted">{[type.label, f.note, f.lead?.name].filter(Boolean).join(" · ")}</span>
                      </div>
                      <Avatar initials={f.owner.initials} size={28} title={f.owner.name} ring={false} />
                      <span className="max-sm:hidden">
                        <DuePill at={f.dueAt} now={now} today={today} />
                      </span>
                      {f.canEdit && <IconButton icon="calendar" label="Reschedule" size={32} tone="chip" onClick={() => setResched(resched === f.id ? null : f.id)} aria-expanded={resched === f.id} />}
                      {f.lead && <IconButton icon="arrowUpRight" label={`Open ${f.lead.name} in WIP`} size={32} tone="chip" onClick={() => router.push(`/wip?focus=${f.lead!.id}`)} />}
                    </div>
                    {resched === f.id && (
                      <div className="flex flex-wrap items-center gap-1.5 py-1 pl-[84px] max-sm:pl-0">
                        <span className="text-xs text-muted">Move to</span>
                        {options.map((o) => (
                          <button key={o.label} type="button" disabled={reschedule.pending} onClick={() => void reschedule.run({ id: f.id, dueDate: o.date, dueTime: o.time })} className="hit-44 h-7 rounded-pill border-0 bg-white px-3 text-xs hover:bg-primary hover:text-white">
                            {o.label}
                          </button>
                        ))}
                        <button type="button" onClick={() => setFollowUpModal({ open: true, followUp: f })} className="hit-44 h-7 rounded-pill border-0 bg-transparent px-3 text-xs text-muted hover:bg-white">
                          Pick a time…
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {tabRows.length === 0 && (
                <div className="flex flex-col items-center gap-2 p-10">
                  <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-surface">
                    <Icon name="check" size={22} />
                  </span>
                  <span className="text-base">All clear</span>
                  <span className="text-[13px] text-muted">Nothing left in this list.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="pm-scroll relative overflow-x-auto">
              <div className="grid min-w-[900px] grid-cols-7 gap-2">
                {week.map((d) => (
                  <div key={d.day} className="flex min-h-[320px] flex-col gap-1.5 rounded-[20px] bg-card p-2" style={{ boxShadow: d.day === today ? "0 0 0 1.5px #023E7D" : "none" }}>
                    <div className="flex items-center justify-between px-1.5 py-1">
                      <span className="text-[13px] font-medium" style={{ color: d.day === today ? "#001233" : "#1C1C1E" }}>
                        {d.label}
                      </span>
                      <span className="text-[11px] text-muted">{d.items.length}</span>
                    </div>
                    {d.items.map((f) => {
                      const overdue = f.tab === "OVERDUE";
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => (f.canEdit ? setFollowUpModal({ open: true, followUp: f }) : f.lead && router.push(`/wip?focus=${f.lead.id}`))}
                          className="flex flex-col gap-0.5 rounded-[14px] border-0 px-2.5 py-2 text-left hover:bg-white"
                          style={{ background: overdue ? "#023E7D" : "#E8E8E8" }}
                        >
                          <span className="text-[11px]" style={{ color: overdue ? "rgba(255,255,255,.88)" : "#55555A" }}>
                            {formatTime12(timeIST(new Date(f.dueAt)))} · {TYPE[f.type]!.label}
                          </span>
                          <span className="text-xs font-medium" style={{ color: overdue ? "#fff" : "#1C1C1E" }}>
                            {f.contactName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ChoiceChips<TaskPriority | "ALL"> label="Priority" options={[{ value: "ALL", label: "All" }, ...TASK_PRIORITIES]} value={prio} onChange={setPrio} />
            <Segmented
              label="Task view"
              size="sm"
              options={[
                { value: "list", label: "List" },
                { value: "board", label: "Board" },
              ]}
              value={taskView}
              onChange={setTaskView}
            />
          </div>

          {taskView === "list" ? (
            visibleTasks.length === 0 ? (
              <EmptyState className="rounded-card bg-card">No tasks here. Create one with New task.</EmptyState>
            ) : (
              <RowTable label="Tasks" minWidth={900} columns={TASK_COLUMNS}>
                <RowHead>
                  <HeadCell />
                  <HeadCell>Task</HeadCell>
                  <HeadCell>Linked to</HeadCell>
                  <HeadCell>Owner</HeadCell>
                  <HeadCell>Due</HeadCell>
                  <HeadCell>Priority</HeadCell>
                  <HeadCell>Status</HeadCell>
                </RowHead>
                {[...visibleTasks]
                  .sort((a, b) => Number(a.status === "DONE") - Number(b.status === "DONE"))
                  .map((t) => {
                    const isDone = t.status === "DONE";
                    return (
                      <Row key={t.id} id={`task-${t.id}`} onClick={() => setDrawerId(t.id)} className="hover:-translate-y-px hover:bg-[#F0F0F0]" style={{ opacity: isDone ? 0.55 : 1 }}>
                        <Cell>
                          <CompleteCircle
                            size={24}
                            done={isDone}
                            label={isDone ? `Reopen “${t.title}”` : `Complete “${t.title}”`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatus(t, isDone ? "TODO" : "DONE");
                            }}
                          />
                        </Cell>
                        <Cell className="text-sm">
                          <span style={{ textDecoration: isDone ? "line-through" : "none" }}>{t.title}</span>
                        </Cell>
                        <Cell className="truncate text-xs text-muted">{t.lead?.name ?? "General"}</Cell>
                        <Cell>
                          <Avatar initials={t.assignee.initials} size={28} title={t.assignee.name} ring={false} />
                        </Cell>
                        <Cell>
                          <DuePill at={t.dueAt} now={now} today={today} done={isDone} />
                        </Cell>
                        <Cell>
                          <StatusPill color={TASK_PRIORITY[t.priority].color}>{TASK_PRIORITY[t.priority].label}</StatusPill>
                        </Cell>
                        <Cell className="text-xs text-muted">{TASK_STATUS[t.status].label}</Cell>
                      </Row>
                    );
                  })}
              </RowTable>
            )
          ) : (
            <div className="pm-scroll relative overflow-x-auto">
              <div className="grid min-w-[860px] grid-cols-3 gap-2">
                {TASK_STATUSES.map((col) => {
                  const cards = visibleTasks.filter((t) => t.status === col.value);
                  const isOver = over === col.value && dragging !== null;
                  return (
                    <div
                      key={col.value}
                      role="list"
                      aria-label={col.label}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (over !== col.value) setOver(col.value);
                      }}
                      onDragLeave={() => setOver((o) => (o === col.value ? null : o))}
                      onDrop={(e) => {
                        e.preventDefault();
                        const t = tasks.find((x) => x.id === e.dataTransfer.getData("text/plain"));
                        setDragging(null);
                        setOver(null);
                        if (t) setStatus(t, col.value);
                      }}
                      className="flex min-h-[420px] flex-col gap-1.5 rounded-card p-2 transition-colors duration-200"
                      style={{ background: isOver ? "linear-gradient(rgba(2,62,125,.12),rgba(2,62,125,.12)),#D1D1D1" : "#D1D1D1", boxShadow: isOver ? "0 0 0 1.5px #023E7D" : "none" }}
                    >
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <span className="h-2 w-2 rounded-pill" style={{ background: col.color }} />
                        <span className="flex-1 text-[13px] font-medium">{col.label}</span>
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-surface px-1.5 text-[11px]">{cards.length}</span>
                      </div>
                      {cards.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          role="listitem"
                          draggable={t.canEdit}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", t.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDragging(t.id);
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setOver(null);
                          }}
                          onClick={() => setDrawerId(t.id)}
                          className="flex cursor-grab flex-col gap-2.5 rounded-row border-0 bg-surface p-3 text-left shadow-raised transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-hover"
                          style={{ opacity: dragging === t.id ? 0.45 : 1, outline: dragging === t.id ? "1.5px dashed #023E7D" : "none", outlineOffset: -1.5 }}
                        >
                          <span className="text-[13px] font-medium" style={{ textDecoration: t.status === "DONE" ? "line-through" : "none" }}>
                            {t.title}
                          </span>
                          <span className="text-[11px] text-muted">{t.lead?.name ?? "General"}</span>
                          <span className="flex items-center gap-1.5">
                            <Avatar initials={t.assignee.initials} size={24} title={t.assignee.name} ring={false} />
                            <StatusPill color={TASK_PRIORITY[t.priority].color} className="h-[22px] text-[10px]">
                              {TASK_PRIORITY[t.priority].label}
                            </StatusPill>
                            <span className="flex-1" />
                            <DuePill at={t.dueAt} now={now} today={today} done={t.status === "DONE"} className="h-[22px] text-[10px]" />
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {taskModal.open && (
        <TaskModal
          task={taskModal.task}
          users={users}
          leads={leads}
          me={me}
          today={today}
          onClose={() => setTaskModal({ open: false, task: null })}
          onSaved={(id) => {
            setTaskModal({ open: false, task: null });
            setMode("tasks");
            if (taskModal.task && id) setDrawerId(id);
          }}
        />
      )}
      {followUpModal.open && (
        <FollowUpModal followUp={followUpModal.followUp} users={users} leads={leads} me={me} today={today} canAssign onClose={() => setFollowUpModal({ open: false, followUp: null })} />
      )}
      {drawerTask && !taskModal.open && (
        <TaskDrawer
          task={drawerTask}
          today={today}
          onClose={() => setDrawerId(null)}
          onEdit={() => setTaskModal({ open: true, task: drawerTask })}
        />
      )}
    </Page>
  );
}
