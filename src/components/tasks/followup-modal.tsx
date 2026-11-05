"use client";

import { useState } from "react";
import type { FollowUpType } from "@/generated/prisma/enums";
import { FOLLOW_UP_TYPES } from "@/lib/constants";
import { addDaysIso } from "@/lib/dates";
import { splitInstant } from "@/lib/tasks";
import { createFollowUpAction, deleteFollowUpAction, updateFollowUpAction } from "@/server/actions/tasks";
import type { FollowUpDto, LeadOption } from "@/server/services/tasks";
import type { UserOption } from "@/server/services/wip";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { FIELD, FormError, inputClass, LABEL } from "../ui/field";
import { Modal } from "../ui/overlay";
import { ChoiceChips } from "../ui/segmented";
import { useAction } from "../ui/toast";


export function FollowUpModal({
  followUp,
  users,
  leads,
  me,
  today,
  canAssign,
  onClose,
}: {
  followUp: FollowUpDto | null;
  users: UserOption[];
  leads: LeadOption[];
  me: string;
  today: string;
  canAssign: boolean;
  onClose: () => void;
}) {
  const due = splitInstant(followUp?.dueAt ?? null) ?? { date: addDaysIso(today, 1), time: "11:00" };
  const [f, setF] = useState({
    contactName: followUp?.contactName ?? "",
    type: (followUp?.type ?? "CALL") as FollowUpType,
    note: followUp?.note ?? "",
    leadId: followUp?.lead?.id ?? null,
    ownerId: followUp?.owner.id ?? me,
    dueDate: due.date,
    dueTime: due.time,
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setError(null);
  };
  const create = useAction(createFollowUpAction, { onSuccess: onClose, onError: (r) => setError(r.error) });
  const update = useAction(updateFollowUpAction, { onSuccess: onClose, onError: (r) => setError(r.error) });
  const remove = useAction(deleteFollowUpAction, { onSuccess: onClose });

  const submit = () => {
    if (f.contactName.trim().length < 2) return setError("Enter who to follow up with");
    if (!f.dueDate || !f.dueTime) return setError("Pick a date and time");
    if (followUp) void update.run({ id: followUp.id, ...f });
    else void create.run(f);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={followUp ? "Edit follow-up" : "New follow-up"}
      subtitle="A call, message or meeting to come back to"
      footer={
        <>
          {followUp && (
            <Button variant="danger-soft" className="mr-auto" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.pending || update.pending}>
            {followUp ? "Save follow-up" : "Schedule follow-up"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Follow up with</span>
          <input data-autofocus value={f.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="e.g. Ritika Sharma · Zeta Fintech" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Linked WIP row</span>
          <select
            value={f.leadId ?? ""}
            onChange={(e) => {
              const id = e.target.value || null;
              const lead = leads.find((l) => l.id === id);
              setF((s) => ({ ...s, leadId: id, contactName: s.contactName.trim() ? s.contactName : (lead?.name ?? "") }));
            }}
            className={inputClass("light", "h-11 cursor-pointer px-3")}
          >
            <option value="">None</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Type</span>
        <ChoiceChips label="Follow-up type" options={FOLLOW_UP_TYPES} value={f.type} onChange={(v) => set("type", v)} />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Note</span>
        <input value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="e.g. Budget confirmation" className={FIELD} />
      </label>
      <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Owner</span>
          <select value={f.ownerId} disabled={!canAssign} onChange={(e) => set("ownerId", e.target.value)} className={inputClass("light", "h-11 cursor-pointer px-3 disabled:cursor-default")}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Date</span>
          <input type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Time</span>
          <input type="time" value={f.dueTime} onChange={(e) => set("dueTime", e.target.value)} className={FIELD} />
        </label>
      </div>
      <FormError message={error} />
      {followUp && (
        <ConfirmDialog
          open={confirmDelete}
          title={`Delete the follow-up with ${followUp.contactName}?`}
          body="It is removed from everyone's list. The audit log keeps a copy."
          confirmLabel="Delete"
          pending={remove.pending}
          onConfirm={() => void remove.run({ id: followUp.id })}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </Modal>
  );
}
