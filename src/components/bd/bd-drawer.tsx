"use client";

import { useState } from "react";
import type { LeadTemperature, MeetingMode, MeetingType } from "@/generated/prisma/enums";
import { MEETING_MODES, MEETING_TYPES, TEMPERATURES } from "@/lib/constants";
import { createBdMeetingAction, deleteBdMeetingAction, updateBdMeetingAction } from "@/server/actions/bd";
import type { BdRowDto } from "@/server/services/bd";
import type { UserOption } from "@/server/services/wip";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { FormError, inputClass } from "../ui/field";
import { Icon } from "../ui/icon";
import { Presence } from "../ui/motion";
import { Drawer } from "../ui/overlay";
import { ChoiceChips } from "../ui/segmented";
import { useAction } from "../ui/toast";

const LABEL = "text-xs font-medium text-muted";

interface BdDrawerProps {
  open: boolean;
  row: BdRowDto | null;
  users: UserOption[];
  me: string;
  today: string;
  canSeeContacts: boolean;
  onClose: () => void;
  onSaved: (id: string | null) => void;
}

export function BdDrawer(props: BdDrawerProps) {
  // Remount per meeting so the form starts from that meeting's values; the last one stays while the drawer closes.
  return <Presence value={props.open && props}>{(shown) => <BdDrawerForm key={shown.row?.id ?? "new"} {...shown} />}</Presence>;
}

function BdDrawerForm({ open, row, users, me, today, canSeeContacts, onClose, onSaved }: BdDrawerProps) {
  const [f, setF] = useState(() => ({
    primaryBrokerId: row?.primary.id ?? me,
    secondaryBrokerId: row?.secondary?.id ?? null,
    meetingDate: row?.date ?? today,
    tenantName: row?.tenantName ?? "",
    contactName: row?.contactName ?? "",
    designation: row?.designation ?? "",
    phone: row?.contact?.phone ?? "",
    email: row?.contact?.email ?? "",
    meetingType: (row?.meetingType ?? "INTRODUCTION") as MeetingType,
    mode: (row?.mode ?? "IN_PERSON") as MeetingMode,
    temperature: (row?.temperature ?? "WARM") as LeadTemperature,
    comments: row?.comments ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setError(null);
  };
  const create = useAction(createBdMeetingAction, { onSuccess: (r) => onSaved(r.data?.id ?? null), onError: (r) => setError(r.error) });
  const update = useAction(updateBdMeetingAction, { onSuccess: () => onSaved(row?.id ?? null), onError: (r) => setError(r.error) });
  const remove = useAction(deleteBdMeetingAction, { onSuccess: () => onSaved(null) });

  const submit = () => {
    if (f.tenantName.trim().length < 2) return setError("Enter the tenant name");
    if (f.contactName.trim().length < 2) return setError("Enter the contact name");
    if (!f.meetingDate) return setError("Pick the meeting date");
    // Hidden contact info is write-only: only send what was typed.
    const contact = canSeeContacts || !row ? { phone: f.phone, email: f.email } : { phone: f.phone || undefined, email: f.email || undefined };
    const input = { ...f, ...contact };
    if (row) void update.run({ id: row.id, ...input });
    else void create.run(input);
  };

  const hiddenHint = row && !canSeeContacts ? "Hidden — type to replace" : undefined;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={540}
      title={row ? "Edit meeting" : "New Meeting"}
      subtitle={row ? `${row.tenantName} · updates this row` : "Adds a row to Business Development"}
      footer={
        <>
          {row?.canDelete && (
            <Button variant="danger-soft" className="mr-auto" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.pending || update.pending}>
            {row ? "Save meeting" : "Add meeting"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Broker</span>
        <ChoiceChips label="Broker" options={users.map((u) => ({ value: u.id, label: u.name }))} value={f.primaryBrokerId} onChange={(v) => setF((s) => ({ ...s, primaryBrokerId: v, secondaryBrokerId: s.secondaryBrokerId === v ? null : s.secondaryBrokerId }))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Secondary broker</span>
        <ChoiceChips
          label="Secondary broker"
          options={[{ value: null, label: "None" }, ...users.filter((u) => u.id !== f.primaryBrokerId).map((u) => ({ value: u.id as string | null, label: u.name }))]}
          value={f.secondaryBrokerId}
          onChange={(v) => set("secondaryBrokerId", v)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Date</span>
          <input type="date" value={f.meetingDate} onChange={(e) => set("meetingDate", e.target.value)} className={inputClass("light", "h-11 px-3.5")} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Tenant name</span>
          <input data-autofocus value={f.tenantName} onChange={(e) => set("tenantName", e.target.value)} placeholder="e.g. Zeta Fintech" className={inputClass("light", "h-11 px-3.5")} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Contact name</span>
          <input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="e.g. Ritika Sharma" className={inputClass("light", "h-11 px-3.5")} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Client designation</span>
          <input value={f.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Head of Admin" className={inputClass("light", "h-11 px-3.5")} />
        </label>
      </div>

      <div className="flex flex-col gap-1.5 rounded-[20px] bg-surface p-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <Icon name="lock" size={12} />
          Client contact info · visible to Admin and Owners only
        </span>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2">
          <input inputMode="tel" aria-label="Client phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder={hiddenHint ?? "Phone"} className="h-10 min-w-0 rounded-[12px] border-0 bg-field px-3 text-sm shadow-inset outline-none focus:shadow-focus" />
          <input type="email" aria-label="Client email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder={hiddenHint ?? "Email"} className="h-10 min-w-0 rounded-[12px] border-0 bg-field px-3 text-sm shadow-inset outline-none focus:shadow-focus" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Meeting type</span>
        <ChoiceChips label="Meeting type" options={MEETING_TYPES} value={f.meetingType} onChange={(v) => set("meetingType", v)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Meeting mode</span>
        <ChoiceChips label="Meeting mode" options={MEETING_MODES} value={f.mode} onChange={(v) => set("mode", v)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Lead temperature</span>
          <select value={f.temperature} onChange={(e) => set("temperature", e.target.value as LeadTemperature)} className={inputClass("light", "h-11 cursor-pointer px-3")}>
            {TEMPERATURES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Comments</span>
          <textarea rows={4} value={f.comments} onChange={(e) => set("comments", e.target.value)} placeholder="What was discussed, next steps, requirements…" className={inputClass("light", "resize-y px-3.5 py-2.5 leading-5")} />
        </label>
      </div>
      <FormError message={error} />

      {row && (
        <ConfirmDialog
          open={confirmDelete}
          title={`Remove the meeting with ${row.tenantName}?`}
          body="It disappears from Business Development for everyone. The audit log keeps a copy."
          confirmLabel="Remove"
          pending={remove.pending}
          onConfirm={() => void remove.run({ id: row.id })}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </Drawer>
  );
}
