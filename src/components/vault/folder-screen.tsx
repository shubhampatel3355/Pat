"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDate, isoDateIST } from "@/lib/dates";
import { formatBytes, UPLOAD_ACCEPT, uploadFiles, uploadSummary } from "@/lib/upload-client";
import type { FileDto } from "@/server/services/files";
import type { FolderCardDto } from "@/server/services/vault";
import type { UserOption } from "@/server/services/wip";
import { EmptyState } from "../ui/bits";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { Icon } from "../ui/icon";
import { Page, PageHeader } from "../ui/page";
import { Cell, HeadCell, Row, RowHead, RowTable } from "../ui/row-table";
import { useToast } from "../ui/toast";
import { UploadModal, type UploadLimits } from "./upload-modal";

const ACTION = "hit-44 flex h-8 w-8 items-center justify-center rounded-pill border-0 bg-chip-2 transition-colors";

export function FolderScreen({
  folder,
  folders,
  files,
  employees,
  me,
  limits,
}: {
  folder: FolderCardDto;
  folders: FolderCardDto[];
  files: FileDto[];
  /** Present when the viewer may see and file every employee's documents. */
  employees: UserOption[] | null;
  me: string;
  limits: UploadLimits;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { show } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [removing, setRemoving] = useState<FileDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [fresh, setFresh] = useState<string[]>(() => params.get("fresh")?.split(",") ?? []);
  const showOwner = folder.key === "EMPLOYEE_DOCUMENTS" && employees !== null;
  const columns = showOwner ? "minmax(260px,2fr) minmax(140px,1fr) 110px 150px minmax(140px,1fr) 90px" : "minmax(260px,2fr) 110px 150px minmax(140px,1fr) 90px";

  useEffect(() => {
    if (params.has("fresh")) router.replace(`/vault/${folder.slug}`, { scroll: false });
  }, [params, router, folder.slug]);

  useEffect(() => {
    if (!fresh.length) return;
    const t = setTimeout(() => setFresh([]), 1400);
    return () => clearTimeout(t);
  }, [fresh]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? files.filter((f) => `${f.name} ${f.ownerName ?? ""}`.toLowerCase().includes(q)) : files;
  }, [files, query]);

  const upload = async (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    setBusy(true);
    const res = await uploadFiles(picked, { folder: folder.key });
    setBusy(false);
    const summary = uploadSummary(res, folder.name);
    if (summary) show(summary.message, summary.tone);
    if (res.files.length) {
      setFresh(res.files.map((f) => f.id));
      router.refresh();
    }
  };

  const remove = async () => {
    if (!removing) return;
    setDeleting(true);
    const res = await fetch(`/api/files/${removing.id}`, { method: "DELETE" }).catch(() => null);
    setDeleting(false);
    if (res?.ok) {
      show(`${removing.name} deleted`);
      setRemoving(null);
      router.refresh();
    } else {
      const body = (await res?.json().catch(() => null)) as { error?: string } | null;
      show(body?.error ?? "The file could not be deleted.", "error");
    }
  };

  return (
    <Page>
      <div className="flex flex-col gap-1.5">
        <Link href="/vault" className="-ml-1.5 inline-flex h-7 items-center self-start rounded-pill px-2.5 text-xs text-muted hover:bg-white/45 hover:text-ink">
          ‹ Contracts &amp; Vault
        </Link>
        <PageHeader
          title={folder.name}
          meta={`${folder.count} file${folder.count === 1 ? "" : "s"} · ${formatBytes(folder.sizeBytes)}`}
          actions={
            <Button icon="upload" loading={busy} onClick={() => (showOwner ? setPicker(true) : input.current?.click())}>
              Upload
            </Button>
          }
        />
      </div>
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

      <label className="flex h-10 min-w-[min(100%,320px)] items-center gap-2 self-start rounded-pill bg-surface px-3.5 shadow-inset focus-within:shadow-focus">
        <Icon name="search" size={15} color="#55555A" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search in this folder" aria-label="Search in this folder" className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none" />
      </label>

      <RowTable label={`${folder.name} files`} minWidth={showOwner ? 900 : 760} columns={columns}>
        <RowHead>
          <HeadCell>Name</HeadCell>
          {showOwner && <HeadCell>Employee</HeadCell>}
          <HeadCell>Size</HeadCell>
          <HeadCell>Uploaded</HeadCell>
          <HeadCell>Uploaded by</HeadCell>
          <HeadCell />
        </RowHead>
        {visible.map((f) => (
          <Row key={f.id} id={`file-${f.id}`} highlighted={fresh.includes(f.id)}>
            <Cell className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[12px] bg-[rgba(2,62,125,.14)] text-[9px] font-semibold text-navy-950">{f.ext}</span>
              <span className="truncate">{f.name}</span>
            </Cell>
            {showOwner && <Cell className="truncate">{f.ownerName ?? "—"}</Cell>}
            <Cell className="text-muted">{formatBytes(f.sizeBytes)}</Cell>
            <Cell className="text-muted">{formatDate(isoDateIST(new Date(f.uploadedAt)))}</Cell>
            <Cell className="truncate">{f.uploadedBy}</Cell>
            <Cell className="flex justify-end gap-1">
              <a href={`/api/files/${f.id}`} download title="Download" aria-label={`Download ${f.name}`} className={`${ACTION} text-ink hover:bg-primary hover:text-white`}>
                <Icon name="download" size={14} />
              </a>
              {f.canDelete && (
                <button type="button" title="Delete" aria-label={`Delete ${f.name}`} onClick={() => setRemoving(f)} className={`${ACTION} text-base text-danger hover:bg-white`}>
                  ×
                </button>
              )}
            </Cell>
          </Row>
        ))}
        {visible.length === 0 && <EmptyState>{files.length ? "No files match." : "This folder is empty. Use Upload to add files."}</EmptyState>}
      </RowTable>

      {picker && <UploadModal folders={folders} initial={folder.key} employees={employees} me={me} limits={limits} onClose={() => setPicker(false)} />}
      <ConfirmDialog
        open={!!removing}
        title={`Delete ${removing?.name ?? "this file"}?`}
        body="It is removed from the vault for everyone. The audit log records the deletion."
        confirmLabel="Delete"
        pending={deleting}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(null)}
      />
    </Page>
  );
}
