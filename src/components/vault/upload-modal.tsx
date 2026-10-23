"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { FolderKey } from "@/generated/prisma/enums";
import { UPLOAD_ACCEPT, UPLOAD_TYPES_LABEL, uploadFiles, uploadSummary } from "@/lib/upload-client";
import type { FolderCardDto } from "@/server/services/vault";
import type { UserOption } from "@/server/services/wip";
import { inputClass } from "../ui/field";
import { Icon } from "../ui/icon";
import { Modal } from "../ui/overlay";
import { useToast } from "../ui/toast";

export interface UploadLimits {
  maxMb: number;
  /** ClamAV is configured, so uploads are scanned. */
  scanned: boolean;
}

/** "Upload to" picker (prototype vfUp): choose a folder — and for Employee Documents, whose — then files. */
export function UploadModal({
  folders,
  initial,
  employees,
  me,
  limits,
  onClose,
}: {
  folders: FolderCardDto[];
  initial?: FolderKey;
  /** Present when the viewer may file documents for any employee. */
  employees: UserOption[] | null;
  me: string;
  limits: UploadLimits;
  onClose: () => void;
}) {
  const router = useRouter();
  const { show } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<FolderKey>(initial ?? folders[0]!.key);
  const [owner, setOwner] = useState(me);
  const [busy, setBusy] = useState(false);
  const folder = folders.find((f) => f.key === target)!;

  const upload = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setBusy(true);
    const res = await uploadFiles(files, { folder: target, ownerUserId: target === "EMPLOYEE_DOCUMENTS" ? owner : undefined });
    setBusy(false);
    const summary = uploadSummary(res, folder.name);
    if (summary) show(summary.message, summary.tone);
    if (res.files.length) {
      onClose();
      router.push(`/vault/${folder.slug}?fresh=${res.files.map((f) => f.id).join(",")}`);
      router.refresh();
    }
  };

  return (
    <Modal open onClose={onClose} title="Upload to" width={440}>
      <div role="radiogroup" aria-label="Folder" className="flex flex-col gap-1">
        {folders.map((f) => {
          const active = f.key === target;
          return (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTarget(f.key)}
              className="flex min-h-12 items-center gap-2.5 rounded-row border-0 px-3 py-1.5 text-left text-sm"
              style={{ background: active ? "#fff" : "#E8E8E8", boxShadow: active ? "0 0 0 1.5px #023E7D" : "none" }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary">
                <Icon name="folder" size={15} color="#fff" />
              </span>
              <span className="flex-1">{f.name}</span>
              <span className="text-xs text-muted">
                {f.count} file{f.count === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>
      {target === "EMPLOYEE_DOCUMENTS" && employees && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Whose documents</span>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass("light", "h-11 cursor-pointer px-3")}>
            {employees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="hit-44 flex h-11 items-center justify-center gap-2 rounded-pill border-0 bg-primary text-sm font-medium text-white shadow-primary hover:bg-primary-hover disabled:bg-steel"
      >
        <Icon name="upload" size={15} />
        {busy ? "Uploading…" : "Choose files"}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={UPLOAD_ACCEPT}
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = "";
        }}
      />
      <span className="text-center text-[11px] text-muted">
        {UPLOAD_TYPES_LABEL} · up to {limits.maxMb} MB each{limits.scanned ? " · virus-scanned before saving" : ""}
      </span>
    </Modal>
  );
}
