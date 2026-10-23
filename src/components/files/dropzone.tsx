"use client";

import { useId, useRef, useState } from "react";
import { fileExt, formatBytes, UPLOAD_ACCEPT } from "@/lib/upload-client";
import { cn } from "../ui/cn";
import { Icon } from "../ui/icon";

/** Dashed "Add documents" drop area with the picked-file list (prototype onboarding drawer). */
export function Dropzone({
  files,
  onChange,
  accept = UPLOAD_ACCEPT,
  title = "Add documents",
  hint = "PDF, JPG or PNG · select several at once",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  title?: string;
  hint?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const add = (list: FileList | null) => {
    if (!list?.length) return;
    onChange([...files, ...Array.from(list)]);
  };
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-dashed p-4 text-center transition-colors",
          over ? "border-primary bg-field" : "border-neutral bg-surface hover:border-primary hover:bg-field",
        )}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-pill bg-chip-2">
          <Icon name="upload" size={18} strokeWidth={1.6} color="#023E7D" />
        </span>
        <span className="text-[13px] font-medium">{title}</span>
        <span className="text-[11px] text-muted">{hint}</span>
        <input
          id={id}
          ref={input}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="flex items-center gap-2.5 rounded-row bg-surface py-2 pl-2.5 pr-2">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-card text-[9px] font-medium text-navy-950">{fileExt(f.name)}</span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px]">{f.name}</span>
            <span className="text-[11px] text-muted">{formatBytes(f.size)}</span>
          </div>
          <button
            type="button"
            title="Remove"
            aria-label={`Remove ${f.name}`}
            onClick={() => onChange(files.filter((_, j) => j !== i))}
            className="hit-44 h-7 w-7 flex-none rounded-pill border-0 bg-chip-2 text-sm text-muted hover:bg-white"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
