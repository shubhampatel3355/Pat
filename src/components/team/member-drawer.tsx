"use client";

import { useState } from "react";
import type { Role } from "@/generated/prisma/enums";
import { paiseToInput, parseRupeesToPaise } from "@/lib/money";
import type { MemberInput } from "@/lib/schemas/team";
import { uploadFiles } from "@/lib/upload-client";
import { inviteMemberAction, resendInviteAction, updateMemberAction } from "@/server/actions/team";
import type { MemberDto } from "@/server/services/team";
import { Dropzone } from "../files/dropzone";
import { AmountInput } from "../ui/amount-input";
import { Button } from "../ui/button";
import { FormError, inputClass } from "../ui/field";
import { Presence } from "../ui/motion";
import { Drawer } from "../ui/overlay";
import { Segmented } from "../ui/segmented";
import { useAction, useToast } from "../ui/toast";

interface MemberDrawerProps {
  open: boolean;
  member: MemberDto | null;
  partners: { id: string; name: string }[];
  canSeeCtc: boolean;
  canMakeOwner: boolean;
  canUploadDocs: boolean;
  onClose: () => void;
  onSaved: (id: string | null) => void;
}

export function MemberDrawer(props: MemberDrawerProps) {
  // Remount per member so the form starts from their values; the last one stays while the drawer closes.
  return <Presence value={props.open && props}>{(shown) => <MemberForm key={shown.member?.id ?? "new"} {...shown} />}</Presence>;
}

function MemberForm({ open, member, partners, canSeeCtc, canMakeOwner, canUploadDocs, onClose, onSaved }: MemberDrawerProps) {
  const { show } = useToast();
  const [name, setName] = useState(member?.name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [title, setTitle] = useState(member?.title ?? "");
  const [role, setRole] = useState<Role>(member?.role ?? "EMPLOYEE");
  const [partnerId, setPartnerId] = useState<string>(member?.partnerId ?? partners[0]?.id ?? "");
  const [doj, setDoj] = useState(member?.dateOfJoining ?? "");
  const [ctc, setCtc] = useState(member?.ctcAnnualPaise ? paiseToInput(member.ctcAnnualPaise) : "");
  const [active, setActive] = useState(member ? member.status !== "INACTIVE" : true);
  const [docs, setDocs] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const afterSave = async (id: string | null) => {
    if (id && docs.length) {
      setUploading(true);
      const result = await uploadFiles(docs, { folder: "EMPLOYEE_DOCUMENTS", ownerUserId: id });
      setUploading(false);
      if (result.errors.length) show(result.errors[0]!, "error");
      else show(`${result.files.length} document${result.files.length === 1 ? "" : "s"} filed in Employee Documents`);
    }
    onSaved(id);
  };

  const invite = useAction(inviteMemberAction, { onSuccess: (r) => void afterSave(r.data?.id ?? null), onError: (r) => setError(r.error) });
  const update = useAction(updateMemberAction, { onSuccess: () => void afterSave(member?.id ?? null), onError: (r) => setError(r.error) });
  const resend = useAction(resendInviteAction);

  const submit = () => {
    if (name.trim().length < 2) return setError("Enter the full name");
    if (phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "").length !== 10) return setError("Enter a 10-digit mobile number");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email");
    const ctcPaise = ctc.trim() ? parseRupeesToPaise(ctc) : null;
    if (ctc.trim() && ctcPaise === null) return setError("Enter the CTC in rupees, e.g. 9,84,000");
    const data: MemberInput = {
      name,
      phone,
      email,
      title,
      role,
      partnerId: role === "OWNER" ? null : partnerId || null,
      dateOfJoining: doj || null,
      ctcAnnualPaise: canSeeCtc ? ctcPaise : (member?.ctcAnnualPaise ?? null),
    };
    setError(null);
    if (member) void update.run({ id: member.id, data, active });
    else void invite.run(data);
  };

  const field = inputClass("light", "h-11 px-3.5");
  const label = "text-xs font-medium text-muted";
  const roleOptions = [
    { value: "EMPLOYEE" as Role, label: "Employee" },
    { value: "ADMIN" as Role, label: "Admin" },
    ...(canMakeOwner ? [{ value: "OWNER" as Role, label: "Owner" }] : []),
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={member ? member.name : "Add member"}
      subtitle={member ? (member.status === "INVITED" ? "Invite pending — they haven't set a password yet" : member.title) : "Onboard a new employee"}
      footer={
        <>
          {member?.status === "INVITED" && (
            <Button variant="secondary" className="mr-auto" loading={resend.pending} onClick={() => void resend.run({ id: member.id })}>
              Resend invite
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={invite.pending || update.pending || uploading}>
            {member ? "Save changes" : "Add member"}
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className={label}>Full name</span>
        <input data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Menon" className={field} />
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Mobile</span>
          <div className="flex gap-1.5">
            <span className="flex h-11 items-center rounded-[14px] bg-surface px-2.5 text-sm">+91</span>
            <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98450 00000" className={inputClass("light", "h-11 flex-1 px-3")} />
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@patmichaels.in" className={field} />
        </label>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Designation</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sales executive" className={field} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className={label}>Access</span>
          <Segmented label="Access role" size="sm" value={role} onChange={setRole} options={roleOptions} className="h-11 items-center" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Date of joining</span>
          <input type="date" value={doj} onChange={(e) => setDoj(e.target.value)} className={field} />
        </label>
        {canSeeCtc && (
          <label className="flex flex-col gap-1.5">
            <span className={label}>Annual CTC (₹)</span>
            <AmountInput value={ctc} onChange={setCtc} placeholder="9,84,000" className={field} />
          </label>
        )}
      </div>
      {role !== "OWNER" && (
        <label className="flex flex-col gap-1.5">
          <span className={label}>Partner</span>
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={inputClass("light", "h-11 cursor-pointer px-3")}>
            <option value="">No partner</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {canUploadDocs && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className={label}>Documents</span>
            <span className="text-[11px] text-muted">ID proof, PAN, offer letter, certificates</span>
          </div>
          <Dropzone files={docs} onChange={setDocs} />
        </div>
      )}
      {member && member.id && (
        <label className="flex items-center justify-between gap-3 rounded-row bg-surface px-3.5 py-3">
          <span className="flex flex-col">
            <span className="text-[13px] font-medium">{active ? "Active" : "Deactivated"}</span>
            <span className="text-[11px] text-muted">{active ? "Can sign in" : "Signed out everywhere; cannot sign in"}</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-primary" checked={active} onChange={(e) => setActive(e.target.checked)} aria-label="Account active" />
        </label>
      )}
      <FormError message={error} />
    </Drawer>
  );
}
