"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { CompanyProfile, InvoiceDocData } from "@/lib/company";
import { InvoiceDocument } from "./invoice-document";

const noSubscribe = () => () => {};
const TOOL = "hit-44 h-10 rounded-pill border-0 bg-white/16 px-[18px] text-[13px] font-medium text-white backdrop-blur-[12px] transition-[background-color,transform,translate,scale] duration-(--duration-micro) hover:bg-white/28 active:scale-[.97] disabled:opacity-60";

export interface DocAction {
  label: string;
  onClick: () => void;
  pending?: boolean;
}

/** Full-frame dark overlay with the branded document and its toolbar (prototype "branded document"). */
export function DocViewer({ data, company, onClose, actions = [] }: { data: InvoiceDocData; company: CompanyProfile; onClose: () => void; actions?: DocAction[] }) {
  const root = useSyncExternalStore(noSubscribe, () => document.getElementById("pm-frame") ?? document.body, () => null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!root) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${data.kind === "PROFORMA" ? "Proforma invoice" : data.kind === "CREDIT_NOTE" ? "Credit note" : "Invoice"} ${data.number}`}
      onClick={onClose}
      className="pm-scroll absolute inset-0 z-[60] flex animate-fade-in flex-col items-center gap-3 overflow-y-auto bg-[rgba(0,18,51,.55)] p-4 backdrop-blur-[8px] scheme-light"
    >
      <div onClick={(e) => e.stopPropagation()} className="sticky top-0 z-[2] flex w-full max-w-[820px] flex-wrap justify-end gap-2">
        {actions.map((a) => (
          <button key={a.label} type="button" onClick={a.onClick} disabled={a.pending} className={TOOL}>
            {a.pending ? `${a.label}…` : a.label}
          </button>
        ))}
        <button
          type="button"
          autoFocus
          onClick={() => window.print()}
          className="hit-44 h-10 rounded-pill border-0 bg-white px-5 text-[13px] font-semibold text-navy-950 shadow-[0_8px_20px_rgba(0,18,51,.3)] transition-[background-color,transform,translate,scale] duration-(--duration-micro) hover:bg-ice active:scale-[.97]"
        >
          Print / Save as PDF
        </button>
        <button type="button" onClick={onClose} title="Close" aria-label="Close" className="hit-44 h-10 w-10 rounded-pill border-0 bg-white/16 text-base text-white transition-[background-color,transform,translate,scale] duration-(--duration-micro) hover:bg-white/28 active:scale-[.94]">
          ×
        </button>
      </div>
      <div onClick={(e) => e.stopPropagation()} className="flex w-full animate-modal-in justify-center">
        <InvoiceDocument data={data} company={company} />
      </div>
    </div>,
    root,
  );
}
