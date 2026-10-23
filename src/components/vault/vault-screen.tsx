"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { formatBytes } from "@/lib/upload-client";
import type { FolderCardDto } from "@/server/services/vault";
import type { UserOption } from "@/server/services/wip";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/bits";
import { Icon } from "../ui/icon";
import { Page, PageHeader } from "../ui/page";
import { UploadModal, type UploadLimits } from "./upload-modal";

const CHIP = "flex h-6 items-center rounded-pill bg-white/16 px-2.5 text-xs";

export function VaultScreen({ folders, employees, me, encrypted, limits }: { folders: FolderCardDto[]; employees: UserOption[] | null; me: string; encrypted: boolean; limits: UploadLimits }) {
  const [upload, setUpload] = useState(false);
  const total = folders.reduce((a, f) => a + f.count, 0);
  return (
    <Page>
      <PageHeader
        title="Contracts & Vault"
        meta={`${folders.length} folder${folders.length === 1 ? "" : "s"} · ${total} file${total === 1 ? "" : "s"}${encrypted ? " · encrypted at rest" : ""}`}
        actions={
          folders.length > 0 && (
            <Button icon="upload" onClick={() => setUpload(true)}>
              Upload
            </Button>
          )
        }
      />
      {folders.length === 0 ? (
        <EmptyState className="rounded-card bg-card">You don’t have access to any vault folders yet.</EmptyState>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
          {folders.map((f) => (
            <Link
              key={f.key}
              href={`/vault/${f.slug}`}
              className="bg-blue-chip relative flex min-h-[220px] flex-col gap-3.5 rounded-panel p-[22px] text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_18px_40px_rgba(0,18,51,.24)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-[3px] hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_24px_56px_rgba(0,18,51,.32)] active:scale-[.98]"
            >
              <span className="flex items-center justify-between">
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[16px] bg-white/16">
                  <Icon name="folder" size={24} color="#fff" />
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-white/16">
                  <Icon name="arrowUpRight" size={14} color="#fff" />
                </span>
              </span>
              <span className="flex-1" />
              <span className="text-[22px] font-medium leading-7 tracking-[-.01em]">{f.name}</span>
              <span className="flex flex-wrap gap-2">
                <span className={CHIP}>
                  {f.count} file{f.count === 1 ? "" : "s"}
                </span>
                <span className={CHIP}>{formatBytes(f.sizeBytes)}</span>
                <span className="flex h-6 items-center px-2.5 text-xs opacity-[.88]">{f.updated ? `Updated ${formatDate(f.updated)}` : "Empty"}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
      {upload && <UploadModal folders={folders} employees={employees} me={me} limits={limits} onClose={() => setUpload(false)} />}
    </Page>
  );
}
