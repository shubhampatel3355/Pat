"use client";

import { useRef, useState } from "react";
import type { CompanyProfile } from "@/lib/company";
import { checkGstin, computeGst, gstinErrorMessage, normaliseGstin, STATE_NAMES } from "@/lib/gstin";
import { draftDocData } from "@/lib/invoice-draft";
import { formatINR, parseRupeesToPaise } from "@/lib/money";
import type { InvoiceInput } from "@/lib/schemas/invoice";
import { UPLOAD_ACCEPT, uploadFiles } from "@/lib/upload-client";
import { createProformaAction, raiseInvoiceAction } from "@/server/actions/invoices";
import { NEW_BROKER } from "../brokers/broker-rows";
import { AmountInput } from "../ui/amount-input";
import { Icon } from "../ui/icon";
import { FIELD_ON_BLUE, inputClass, LABEL_ON_BLUE } from "../ui/field";
import { useAction, useToast } from "../ui/toast";
import { DocViewer } from "./doc-viewer";

export interface ShareRow {
  kind: "user" | "external" | "empty";
  userId?: string;
  name?: string;
  pct: string;
}

export interface FormPrefill {
  leadId: string;
  leadName: string;
  payeeName: string;
  narration: string;
  feesRupees: string;
  brokers: ShareRow[];
}

interface DocumentFormProps {
  variant: "INVOICE" | "PROFORMA";
  nextNumber: string;
  today: string;
  users: { id: string; name: string }[];
  company: CompanyProfile;
  prefill: FormPrefill | null;
  onCreated: (id: string) => void;
  onClearPrefill: () => void;
}


function blankState(prefill: FormPrefill | null) {
  return {
    payee: prefill?.payeeName ?? "",
    address: "",
    gstin: "",
    narration: prefill?.narration ?? "",
    terms: "",
    mobile: "",
    email: "",
    fees: prefill?.feesRupees ?? "",
    validity: 15 as 7 | 15 | 30,
    brokers: prefill?.brokers.length ? prefill.brokers : ([{ kind: "empty", pct: "" }] as ShareRow[]),
  };
}

export function DocumentForm(props: DocumentFormProps) {
  // Remount when the linked WIP row changes so prefilled values apply cleanly.
  return <Form key={`${props.variant}-${props.prefill?.leadId ?? "none"}`} {...props} />;
}

function Form({ variant, nextNumber, today, users, company, prefill, onCreated, onClearPrefill }: DocumentFormProps) {
  const { show } = useToast();
  const [f, setF] = useState(() => blankState(prefill));
  const [docs, setDocs] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ReturnType<typeof blankState>>(k: K, v: ReturnType<typeof blankState>[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setError(null);
  };

  const afterCreate = async (id: string) => {
    if (docs.length) {
      const r = await uploadFiles(docs, { invoiceId: id });
      if (r.errors.length) show(r.errors[0]!, "error");
    }
    setF(blankState(null));
    setDocs([]);
    onClearPrefill();
    onCreated(id);
  };
  const raise = useAction(raiseInvoiceAction, { onSuccess: (r) => void afterCreate(r.data!.id), onError: (r) => setError(r.error) });
  const proforma = useAction(createProformaAction, { onSuccess: (r) => void afterCreate(r.data!.id), onError: (r) => setError(r.error) });

  const companyState = company.gstin.slice(0, 2);
  const feesPaise = parseRupeesToPaise(f.fees) ?? 0;
  const gstin = normaliseGstin(f.gstin);
  const gstCheck = checkGstin(gstin);
  const gst = computeGst(feesPaise, gstCheck.ok ? gstCheck.stateCode : null, companyState);
  const gstHint = !gstin
    ? "15-character GSTIN"
    : gstCheck.ok
      ? gst.intraState
        ? `Valid · ${STATE_NAMES[gstCheck.stateCode] ?? gstCheck.stateCode} · CGST 9% + SGST 9%`
        : `Valid · ${STATE_NAMES[gstCheck.stateCode] ?? "other state"} · IGST 18%`
      : gstin.length < 15
        ? `${gstin.length}/15 characters`
        : gstinErrorMessage(gstCheck.reason);

  const filled = f.brokers.filter((b) => (b.kind === "user" && b.userId) || (b.kind === "external" && b.name?.trim()));
  const shareSum = filled.reduce((a, b) => a + (Number(b.pct) || 0), 0);
  const totalPill = !filled.length
    ? { label: "Optional · total 100%", bg: "rgba(255,255,255,.16)", fg: "#fff" }
    : shareSum === 100
      ? { label: "Total 100% ✓", bg: "rgba(62,155,82,.9)", fg: "#fff" }
      : { label: `Total ${shareSum}%`, bg: "rgba(232,184,74,.95)", fg: "#1C1C1E" };

  const toInput = (): InvoiceInput | null => {
    if (f.payee.trim().length < 2) return setError("Enter the payee name"), null;
    if (f.address.trim().length < 8) return setError("Enter the bill-to address"), null;
    if (!gstCheck.ok) return setError(gstin.length === 15 ? gstinErrorMessage(gstCheck.reason) : "Enter a valid 15-character GSTIN"), null;
    if (f.mobile.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "").length !== 10) return setError("Enter a 10-digit mobile number"), null;
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setError("Enter a valid email"), null;
    if (!feesPaise) return setError("Enter the total fees"), null;
    if (f.terms.trim().length < 2) return setError("Enter the payment terms"), null;
    if (filled.length && shareSum !== 100) return setError("Broker shares must add up to 100%"), null;
    if (filled.some((b) => !(Number(b.pct) > 0))) return setError("Give every broker a share"), null;
    return {
      payeeName: f.payee,
      billingAddress: f.address,
      gstin,
      narration: f.narration,
      paymentTerms: f.terms,
      mobile: f.mobile,
      email: f.email,
      feesPaise,
      leadId: prefill?.leadId ?? null,
      brokers: filled.map((b) => (b.kind === "user" ? { userId: b.userId!, sharePct: Number(b.pct) } : { externalName: b.name!.trim(), sharePct: Number(b.pct) })),
    };
  };

  const submit = () => {
    const input = toInput();
    if (!input) return;
    if (variant === "INVOICE") void raise.run(input);
    else void proforma.run({ ...input, validityDays: f.validity });
  };

  const openPreview = () => {
    if (f.payee.trim().length < 2) return setError("Enter the payee name to preview");
    setPreview(true);
  };

  const brokerName = (b: ShareRow) => (b.kind === "user" ? (users.find((u) => u.id === b.userId)?.name ?? "—") : (b.name ?? "—"));
  const breakdown =
    variant === "INVOICE"
      ? [
          { k: "Fees", v: formatINR(feesPaise), strong: false },
          { k: gst.intraState ? "GST 18% (CGST 9% + SGST 9%)" : "IGST 18%", v: formatINR(gst.gstPaise), strong: false },
          { k: "Total payable", v: formatINR(feesPaise + gst.gstPaise), strong: true },
        ]
      : [
          { k: "Fees", v: formatINR(feesPaise), strong: false },
          { k: "GST 18%", v: formatINR(gst.gstPaise), strong: false },
          { k: "Total (proforma)", v: formatINR(feesPaise + gst.gstPaise), strong: true },
        ];

  const pending = raise.pending || proforma.pending;
  const title = variant === "INVOICE" ? "Raise invoice" : "Proforma invoice";
  const subtitle = variant === "INVOICE" ? `Invoice ${nextNumber} · ${today}` : `${nextNumber} · Not a tax invoice · valid for ${f.validity} days`;

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-pill bg-white/16">
        <Icon name="invoice" size={18} color="#fff" />
      </span>
      <div className="flex min-w-[160px] flex-1 flex-col">
        <h2 className="m-0 text-[22px] font-normal leading-7 tracking-[-.01em]">{title}</h2>
        <span className="text-xs text-white/88">{subtitle}</span>
      </div>
      {prefill && (
        <span className="flex h-[30px] items-center gap-2 rounded-pill bg-white/16 py-0 pl-3 pr-1.5 text-xs">
          Linked to WIP · {prefill.leadName}
          <button type="button" onClick={onClearPrefill} title="Unlink" aria-label="Unlink WIP row" className="h-5 w-5 rounded-pill border-0 bg-white/20 p-0 text-xs text-white">
            ×
          </button>
        </span>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="hit-44 h-11 whitespace-nowrap rounded-pill border-0 bg-white px-6 text-sm font-semibold text-navy-950 shadow-[0_8px_20px_rgba(0,18,51,.3)] hover:bg-ice active:scale-[.97] active:bg-[#DDE3EC] disabled:opacity-70"
      >
        {pending ? "Saving…" : variant === "INVOICE" ? "Raise invoice" : "Create proforma"}
      </button>
    </div>
  );

  const brokersBox = (
    <div className="flex flex-col gap-2 rounded-[20px] bg-white/10 p-3.5" role="group" aria-label="Brokers and share">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-[13px] font-medium">Brokers &amp; share (%)</span>
        <span className="flex h-6 items-center rounded-pill px-2.5 text-[11px] font-medium" style={{ background: totalPill.bg, color: totalPill.fg }}>
          {totalPill.label}
        </span>
      </div>
      {f.brokers.map((b, i) => {
        const taken = f.brokers.flatMap((x, j) => (j !== i && x.kind === "user" && x.userId ? [x.userId] : []));
        const update = (patch: Partial<ShareRow>) => set("brokers", f.brokers.map((x, j) => (j === i ? { ...x, ...patch } : x)));
        return (
          <div key={i} className="flex items-center gap-1.5">
            {b.kind === "external" ? (
              <input aria-label={`Broker ${i + 1} name`} autoFocus value={b.name ?? ""} onChange={(e) => update({ name: e.target.value })} placeholder="Type broker's full name" className={inputClass("onBlue", "h-11 flex-1 px-3.5")} />
            ) : (
              <select
                aria-label={`Broker ${i + 1}`}
                value={b.kind === "user" ? b.userId : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  update(v === NEW_BROKER ? { kind: "external", name: "", userId: undefined } : v ? { kind: "user", userId: v } : { kind: "empty", userId: undefined });
                }}
                className={inputClass("onBlue", "h-11 flex-1 cursor-pointer px-3")}
              >
                <option value="">Select broker</option>
                {users
                  .filter((u) => !taken.includes(u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                <option value={NEW_BROKER}>+ Add a new broker…</option>
              </select>
            )}
            <div className="flex h-11 w-24 flex-none items-center gap-1 rounded-[14px] bg-white px-3 text-ink">
              <input aria-label={`Broker ${i + 1} share`} inputMode="numeric" value={b.pct} onChange={(e) => update({ pct: e.target.value.replace(/\D/g, "").slice(0, 3) })} placeholder="0" className="w-full min-w-0 border-0 bg-transparent text-right text-sm outline-none" />
              <span className="text-[13px] text-muted">%</span>
            </div>
            <button
              type="button"
              title="Remove"
              aria-label={`Remove broker ${i + 1}`}
              onClick={() => set("brokers", f.brokers.length > 1 ? f.brokers.filter((_, j) => j !== i) : [{ kind: "empty", pct: "" }])}
              className="hit-44 h-9 w-9 flex-none rounded-pill border-0 bg-white/16 text-base text-white hover:bg-white/28"
            >
              ×
            </button>
          </div>
        );
      })}
      <button type="button" onClick={() => set("brokers", [...f.brokers, { kind: "empty", pct: "" }])} className="hit-44 h-9 self-start whitespace-nowrap rounded-pill border-0 bg-white px-4 text-[13px] font-semibold text-navy-950 hover:bg-ice active:scale-[.97]">
        + Add broker
      </button>
    </div>
  );

  const breakdownBox = (
    <div className="flex flex-col gap-1 rounded-row bg-white/12 px-3.5 py-3">
      {breakdown.map((r) => (
        <div key={r.k} className="flex justify-between text-[13px]" style={{ fontWeight: r.strong ? 600 : 400 }}>
          <span className="opacity-90">{r.k}</span>
          <span>{r.v}</span>
        </div>
      ))}
    </div>
  );

  const footer = (
    <>
      {error && (
        <span role="alert" className="text-xs text-[#FFD2CC]">
          − {error}
        </span>
      )}
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {docs.map((d, i) => (
            <span key={`${d.name}-${i}`} className="flex h-[30px] max-w-full items-center gap-2 rounded-pill bg-white/16 py-0 pl-3 pr-1.5 text-xs text-white">
              <span className="truncate">{d.name}</span>
              <button type="button" title="Remove" aria-label={`Remove ${d.name}`} onClick={() => setDocs(docs.filter((_, j) => j !== i))} className="h-5 w-5 rounded-pill border-0 bg-white/20 p-0 text-xs text-white">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setF(blankState(null));
            setDocs([]);
            setError(null);
            onClearPrefill();
          }}
          className="hit-44 h-11 rounded-pill border-0 bg-white/14 px-5 text-sm font-medium text-white hover:bg-white/24"
        >
          Clear
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} className="hit-44 flex h-11 items-center gap-2 rounded-pill border-0 bg-white/14 px-5 text-sm font-medium text-white hover:bg-white/24">
          <Icon name="upload" size={15} strokeWidth={1.8} color="#fff" />
          Upload documents
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (picked.length) {
              setDocs([...docs, ...picked]);
              show(`${picked.length} document${picked.length > 1 ? "s" : ""} attached`);
            }
          }}
        />
        <button type="button" onClick={openPreview} className="hit-44 flex h-11 items-center gap-2 whitespace-nowrap rounded-pill border-[1.5px] border-white/70 bg-transparent px-5 text-sm font-medium text-white hover:bg-white/14 active:scale-[.97]">
          <Icon name="print" size={15} strokeWidth={1.7} color="#fff" />
          Preview &amp; print
        </button>
      </div>
    </>
  );

  return (
    <section aria-label={title} className="bg-blue-card flex flex-col gap-[18px] rounded-panel p-6 text-white shadow-blue-form">
      {header}
      {variant === "INVOICE" ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
          <div className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_ON_BLUE}>Payee name</span>
              <input value={f.payee} onChange={(e) => set("payee", e.target.value)} placeholder="e.g. Zeta Fintech Pvt Ltd" className={FIELD_ON_BLUE} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_ON_BLUE}>Bill to address</span>
              <textarea rows={3} value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Building, street, area, city, PIN" className={inputClass("onBlue", "resize-y px-3.5 py-2.5 leading-5")} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_ON_BLUE}>GST details</span>
              <input value={f.gstin} maxLength={15} onChange={(e) => set("gstin", normaliseGstin(e.target.value))} placeholder="GSTIN · e.g. 29AAKFP4821L1ZR" className={inputClass("onBlue", "h-11 px-3.5 uppercase tracking-[.04em]")} />
              <span className="text-[11px] text-white/88">{gstHint}</span>
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL_ON_BLUE}>Mobile</span>
                <div className="flex gap-1.5">
                  <span className="flex h-11 items-center rounded-[14px] bg-white/16 px-2.5 text-sm">+91</span>
                  <input inputMode="tel" value={f.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="98450 00000" className={inputClass("onBlue", "h-11 flex-1 px-3")} />
                </div>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL_ON_BLUE}>Email</span>
                <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="accounts@company.com" className={FIELD_ON_BLUE} />
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_ON_BLUE}>Narration</span>
              <textarea rows={3} value={f.narration} onChange={(e) => set("narration", e.target.value)} placeholder="e.g. Brokerage for leasing 12,500 sq ft at Prestige Tech Park" className={inputClass("onBlue", "resize-y px-3.5 py-2.5 leading-5")} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_ON_BLUE}>Payment terms</span>
              <input value={f.terms} onChange={(e) => set("terms", e.target.value)} placeholder="e.g. Net 30 days from invoice date" className={FIELD_ON_BLUE} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_ON_BLUE}>Total fees (₹, before GST)</span>
              <AmountInput value={f.fees} onChange={(v) => set("fees", v)} placeholder="11,50,000" className={FIELD_ON_BLUE} />
            </label>
            {breakdownBox}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_ON_BLUE}>Payee name</span>
              <input value={f.payee} onChange={(e) => set("payee", e.target.value)} placeholder="e.g. Halcyon Health Pvt Ltd" className={FIELD_ON_BLUE} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_ON_BLUE}>GST details (GSTIN)</span>
              <input value={f.gstin} maxLength={15} onChange={(e) => set("gstin", normaliseGstin(e.target.value))} placeholder="15-character GSTIN" aria-describedby="pf-gst-hint" className={inputClass("onBlue", "h-11 px-3.5 uppercase tracking-[.04em]")} />
              <span id="pf-gst-hint" className="text-[11px] text-white/88">
                {gstHint}
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_ON_BLUE}>Mobile</span>
              <input inputMode="tel" value={f.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="98450 00000" className={FIELD_ON_BLUE} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_ON_BLUE}>Email</span>
              <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="accounts@company.com" className={FIELD_ON_BLUE} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_ON_BLUE}>Total fees (₹)</span>
              <AmountInput value={f.fees} onChange={(v) => set("fees", v)} placeholder="5,00,000" className={FIELD_ON_BLUE} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_ON_BLUE}>Payment terms</span>
              <input value={f.terms} onChange={(e) => set("terms", e.target.value)} placeholder="e.g. 50% on acceptance, balance on LOI" className={FIELD_ON_BLUE} />
            </label>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_ON_BLUE}>Bill-to address</span>
              <input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Registered office address" className={FIELD_ON_BLUE} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_ON_BLUE}>Narration</span>
              <input value={f.narration} onChange={(e) => set("narration", e.target.value)} placeholder="e.g. Brokerage — 180 seats at Embassy Golf Links" className={FIELD_ON_BLUE} />
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium opacity-92">Valid for</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Valid for">
              {([7, 15, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={f.validity === d}
                  onClick={() => set("validity", d)}
                  className="hit-44 h-[34px] whitespace-nowrap rounded-pill border-0 px-4 text-[13px]"
                  style={{ background: f.validity === d ? "#fff" : "rgba(255,255,255,.16)", color: f.validity === d ? "#001233" : "#fff" }}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>
          {breakdownBox}
        </>
      )}
      {brokersBox}
      {footer}
      {preview && (
        <DocViewer
          company={company}
          onClose={() => setPreview(false)}
          data={draftDocData(
            companyState,
            variant,
            {
              payeeName: f.payee.trim(),
              billingAddress: f.address.trim(),
              gstin,
              narration: f.narration.trim(),
              paymentTerms: f.terms.trim(),
              mobile: f.mobile,
              email: f.email.trim(),
              feesPaise,
              validityDays: f.validity,
              brokers: filled.map((b) => ({ name: brokerName(b), pct: Number(b.pct) || 0 })),
            },
            nextNumber,
          )}
        />
      )}
    </section>
  );
}
