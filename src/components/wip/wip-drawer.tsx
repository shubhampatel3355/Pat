"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LandlordType, PricingBasis, WipRemark } from "@/generated/prisma/enums";
import { WIP_REMARKS } from "@/lib/constants";
import { formatCompactINR, paiseToInput, parseRupeesToPaise } from "@/lib/money";
import type { LeadInput } from "@/lib/schemas/wip";
import { estimatedFeesPaise, monthlyRentPaise } from "@/lib/wip";
import { createLeadAction, deleteLeadAction, updateLeadAction } from "@/server/actions/wip";
import type { UserOption, WipRowDto } from "@/server/services/wip";
import { BrokerRows, draftsFromChips, type BrokerDraft } from "../brokers/broker-rows";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { FormError, inputClass } from "../ui/field";
import { Presence } from "../ui/motion";
import { Drawer } from "../ui/overlay";
import { Segmented } from "../ui/segmented";
import { useAction } from "../ui/toast";

const digits = (s: string) => s.replace(/[^\d]/g, "");

interface FormState {
  tenantName: string;
  landlordType: LandlordType;
  landlordName: string;
  pricingBasis: PricingBasis;
  area: string;
  seats: string;
  rate: string;
  building: string;
  location: string;
  primary: BrokerDraft[];
  secondary: BrokerDraft[];
  closureDate: string;
  remark: WipRemark;
}

function initialState(row: WipRowDto | null, me: string, defaultClosure: string): FormState {
  if (!row) {
    return {
      tenantName: "",
      landlordType: "LANDLORD",
      landlordName: "",
      pricingBasis: "PER_SQFT",
      area: "",
      seats: "",
      rate: "",
      building: "",
      location: "",
      primary: [{ kind: "user", userId: me }],
      secondary: [],
      closureDate: defaultClosure,
      remark: "VISITS",
    };
  }
  return {
    tenantName: row.tenantName,
    landlordType: row.landlordType,
    landlordName: row.landlordName,
    pricingBasis: row.pricingBasis,
    area: row.areaSqft ? String(row.areaSqft) : "",
    seats: row.seats ? String(row.seats) : "",
    rate: paiseToInput(row.ratePaise).replace(/,/g, ""),
    building: row.building,
    location: row.location,
    primary: draftsFromChips(row.primary),
    secondary: draftsFromChips(row.secondary),
    closureDate: row.closureDate,
    remark: row.remark,
  };
}

function toInput(f: FormState): { input: LeadInput | null; error: string | null } {
  if (f.tenantName.trim().length < 2) return { input: null, error: "Enter the tenant name" };
  const areaSqft = f.pricingBasis === "PER_SQFT" ? Number(digits(f.area)) || null : null;
  const seats = f.pricingBasis === "PER_SEAT" ? Number(digits(f.seats)) || null : null;
  if (f.pricingBasis === "PER_SQFT" && !areaSqft) return { input: null, error: "Enter the area" };
  if (f.pricingBasis === "PER_SEAT" && !seats) return { input: null, error: "Enter the number of seats" };
  const ratePaise = parseRupeesToPaise(f.rate);
  if (!ratePaise) return { input: null, error: f.pricingBasis === "LUMPSUM" ? "Enter the lumpsum amount" : "Enter the rent" };
  if (!f.location.trim()) return { input: null, error: "Enter the location" };
  const primaryBrokerIds = f.primary.flatMap((b) => (b.kind === "user" ? [b.userId] : []));
  if (!primaryBrokerIds.length) return { input: null, error: "Select a primary broker" };
  const secondaryBrokers = f.secondary.flatMap((b): LeadInput["secondaryBrokers"] =>
    b.kind === "user" ? [{ userId: b.userId }] : b.kind === "external" && b.name.trim() ? [{ externalName: b.name.trim() }] : [],
  );
  return {
    input: {
      tenantName: f.tenantName,
      landlordType: f.landlordType,
      landlordName: f.landlordName,
      pricingBasis: f.pricingBasis,
      areaSqft,
      seats,
      ratePaise,
      building: f.building,
      location: f.location,
      primaryBrokerIds,
      secondaryBrokers,
      closureDate: f.closureDate,
      remark: f.remark,
    },
    error: null,
  };
}

interface WipDrawerProps {
  open: boolean;
  onClose: () => void;
  row: WipRowDto | null;
  users: UserOption[];
  me: string;
  defaultClosure: string;
  canInvoice: boolean;
  onSaved: (id: string | null) => void;
}

export function WipDrawer(props: WipDrawerProps) {
  // Remount per row so the form always starts from that row's values; the last one stays while the drawer closes.
  return <Presence value={props.open && props}>{(shown) => <WipDrawerForm key={shown.row?.id ?? "new"} {...shown} />}</Presence>;
}

function WipDrawerForm({ open, onClose, row, users, me, defaultClosure, canInvoice, onSaved }: WipDrawerProps) {
  const [f, setF] = useState<FormState>(() => initialState(row, me, defaultClosure));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setError(null);
  };

  const create = useAction(createLeadAction, { onSuccess: (r) => onSaved(r.data?.id ?? null), onError: (r) => setError(r.error) });
  const update = useAction(updateLeadAction, { onSuccess: () => onSaved(row?.id ?? null), onError: (r) => setError(r.error) });
  const remove = useAction(deleteLeadAction, { onSuccess: () => onSaved(null) });

  const ratePaise = parseRupeesToPaise(f.rate) ?? 0;
  const area = Number(digits(f.area)) || null;
  const seats = Number(digits(f.seats)) || null;
  const monthly = monthlyRentPaise(f.pricingBasis, ratePaise, area, seats);
  const fees = estimatedFeesPaise(f.pricingBasis, ratePaise, area, seats);
  const primaryIds = useMemo(() => f.primary.flatMap((b) => (b.kind === "user" ? [b.userId] : [])), [f.primary]);
  const secondaryIds = useMemo(() => f.secondary.flatMap((b) => (b.kind === "user" ? [b.userId] : [])), [f.secondary]);

  const submit = () => {
    const { input, error: problem } = toInput(f);
    if (!input) return setError(problem);
    if (row) void update.run({ id: row.id, data: input });
    else void create.run(input);
  };

  const pending = create.pending || update.pending || remove.pending;
  const label = "text-xs font-medium text-muted";
  const field = inputClass("light", "h-11 px-3.5");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={row ? "Edit Tenant / Lead" : "New Tenant / Lead"}
      subtitle={row ? "Updates this WIP row" : "Adds a row to WIP"}
      footer={
        <>
          {row?.canDelete && (
            <Button variant="danger-soft" className={canInvoice ? undefined : "mr-auto"} disabled={pending} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          {row && canInvoice && (
            <Link href={`/invoices?lead=${row.id}`} className="hit-44 mr-auto inline-flex h-10 items-center rounded-pill bg-surface px-[18px] text-[13px] font-medium text-ink hover:bg-raised hover:text-ink">
              Raise invoice
            </Link>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.pending || update.pending}>
            {row ? "Save changes" : "Add to WIP"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Tenant name</span>
          <input data-autofocus value={f.tenantName} onChange={(e) => set("tenantName", e.target.value)} placeholder="e.g. Zeta Fintech" className={field} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className={label}>Landlord / Operator</span>
          <Segmented
            label="Landlord or operator"
            size="sm"
            value={f.landlordType}
            onChange={(v) => set("landlordType", v)}
            options={[
              { value: "LANDLORD", label: "Landlord" },
              { value: "OPERATOR", label: "Operator" },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={label}>Pricing basis</span>
        <Segmented
          label="Pricing basis"
          size="sm"
          value={f.pricingBasis}
          onChange={(v) => set("pricingBasis", v)}
          options={[
            { value: "PER_SQFT", label: "Per sq ft" },
            { value: "PER_SEAT", label: "Per seat" },
            { value: "LUMPSUM", label: "Lumpsum" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {f.pricingBasis === "PER_SQFT" && (
          <label className="flex flex-col gap-1.5">
            <span className={label}>Area (sq ft)</span>
            <input inputMode="numeric" value={f.area} onChange={(e) => set("area", digits(e.target.value))} placeholder="10,000" className={field} />
          </label>
        )}
        {f.pricingBasis === "PER_SEAT" && (
          <label className="flex flex-col gap-1.5">
            <span className={label}>Seats</span>
            <input inputMode="numeric" value={f.seats} onChange={(e) => set("seats", digits(e.target.value))} placeholder="120" className={field} />
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className={label}>{f.pricingBasis === "PER_SEAT" ? "Rent / seat (₹)" : f.pricingBasis === "LUMPSUM" ? "Lumpsum amount (₹)" : "Rent / sq ft (₹)"}</span>
          <input
            inputMode="decimal"
            value={f.rate}
            onChange={(e) => set("rate", e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))}
            placeholder={f.pricingBasis === "PER_SEAT" ? "9,500" : f.pricingBasis === "LUMPSUM" ? "5,00,000" : "90"}
            className={field}
          />
        </label>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Building</span>
          <input value={f.building} onChange={(e) => set("building", e.target.value)} placeholder="e.g. RMZ Ecospace" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Location</span>
          <input value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Bellandur, ORR" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Landlord / Operator name</span>
          <input value={f.landlordName} onChange={(e) => set("landlordName", e.target.value)} placeholder="e.g. RMZ Corp / WeWork" className={field} />
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[20px] bg-surface p-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">Estimated fees</span>
          <span className="text-[11px] text-muted">{monthly ? `${formatCompactINR(monthly)} / month · 1 month's rent` : "1 month’s rent · fills in as you type"}</span>
        </div>
        <span className="text-[28px] font-light" aria-live="polite">
          {formatCompactINR(fees)}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={label}>Primary brokers</span>
        <BrokerRows label="Primary broker" rows={f.primary} onChange={(r) => set("primary", r)} users={users} takenElsewhere={secondaryIds} allowExternal={false} minRows={1} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={label}>Secondary brokers</span>
        <BrokerRows label="Secondary broker" rows={f.secondary} onChange={(r) => set("secondary", r)} users={users} takenElsewhere={primaryIds} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Estimated closure date</span>
          <input type="date" value={f.closureDate} onChange={(e) => set("closureDate", e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Remark</span>
          <select value={f.remark} onChange={(e) => set("remark", e.target.value as WipRemark)} className={inputClass("light", "h-11 cursor-pointer px-3")}>
            {WIP_REMARKS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FormError message={error} />
      {row && (
        <ConfirmDialog
          open={confirmDelete}
          title={`Remove ${row.tenantName}?`}
          body="The row disappears from WIP for everyone. The audit log keeps a copy."
          confirmLabel="Remove"
          pending={remove.pending}
          onConfirm={() => void remove.run({ id: row.id })}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </Drawer>
  );
}
