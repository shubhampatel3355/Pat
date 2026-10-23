"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { CarType } from "@/generated/prisma/enums";
import { CAB_STATUS, CAR_TYPES } from "@/lib/constants";
import { formatDate, formatTime12 } from "@/lib/dates";
import { bookCabAction, setCabStatusAction } from "@/server/actions/vehicles";
import type { CabRowDto, PersonOption } from "@/server/services/vehicles";
import { Avatar, EmptyState, StatusPill } from "../ui/bits";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { FormError, inputClass } from "../ui/field";
import { Icon } from "../ui/icon";
import { Page, PageHeader, SectionTitle } from "../ui/page";
import { Cell, HeadCell, Row, RowHead, RowTable } from "../ui/row-table";
import { ChoiceChips } from "../ui/segmented";
import { useAction } from "../ui/toast";

const COLUMNS = "56px minmax(180px,1.2fr) 170px 120px 120px 90px minmax(200px,1.4fr) 130px 120px 200px";
const LABEL = "text-xs font-medium text-white/92";

interface VehiclesScreenProps {
  rows: CabRowDto[];
  stats: { today: number; upcoming: number; all: number };
  people: PersonOption[];
  places: string[];
  me: string;
  today: string;
}

export function VehiclesScreen({ rows, stats, people, places, me, today }: VehiclesScreenProps) {
  const router = useRouter();
  const params = useSearchParams();
  const blank = { carType: "SEDAN" as CarType, clientName: "", pickupDate: today, pickupTime: "10:00", pickupLocation: "", bookedForId: me };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(() => params.get("focus"));
  const [cancelling, setCancelling] = useState<CabRowDto | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };
  const book = useAction(bookCabAction, {
    onSuccess: (r) => {
      setForm((f) => ({ ...f, clientName: "", pickupLocation: "" }));
      setFresh(r.data?.id ?? null);
    },
    onError: (r) => setError(r.error),
  });
  const status = useAction(setCabStatusAction, { onSuccess: () => setCancelling(null) });

  useEffect(() => {
    const focus = params.get("focus");
    if (focus) document.getElementById(`cab-${focus}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (focus) router.replace("/vehicles", { scroll: false });
  }, [params, router]);

  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(null), 1400);
    return () => clearTimeout(t);
  }, [fresh]);

  const submit = () => {
    if (form.clientName.trim().length < 2) return setError("Enter the client name");
    if (!form.pickupDate) return setError("Pick a date");
    if (form.pickupDate < today) return setError("Pick today or a later date");
    if (!form.pickupTime) return setError("Pick a time");
    if (form.pickupLocation.trim().length < 3) return setError("Enter the pick-up location");
    void book.run(form);
  };

  return (
    <Page>
      <PageHeader title="Vehicle Management" meta={`${stats.upcoming} upcoming · ${stats.today} today`} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-2">
        <section aria-label="Book a cab" className="bg-blue-card flex flex-col gap-4 rounded-panel p-[22px] text-white shadow-blue-form">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-pill bg-white/16">
              <Icon name="car" size={18} color="#fff" />
            </span>
            <div className="flex flex-1 flex-col">
              <h2 className="m-0 text-[22px] font-normal leading-7 tracking-[-.01em]">Book a cab</h2>
              <span className="text-xs text-white/88">Open to everyone in the company</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Type of car</span>
            <ChoiceChips
              label="Type of car"
              tone="onBlue"
              options={CAR_TYPES.map((c) => ({
                value: c.value,
                label: (
                  <span className="flex items-center gap-1.5">
                    {c.label} <span className="text-[11px] opacity-80">{c.seats}</span>
                  </span>
                ),
              }))}
              value={form.carType}
              onChange={(v) => set("carType", v)}
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Client name</span>
            <input value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="e.g. Zeta Fintech" className={inputClass("onBlue", "h-11 px-3.5")} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Date</span>
              <input type="date" min={today} value={form.pickupDate} onChange={(e) => set("pickupDate", e.target.value)} className={inputClass("onBlue", "h-11 px-3.5")} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Time</span>
              <input type="time" value={form.pickupTime} onChange={(e) => set("pickupTime", e.target.value)} className={inputClass("onBlue", "h-11 px-3.5")} />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Pick-up location</span>
            <input value={form.pickupLocation} onChange={(e) => set("pickupLocation", e.target.value)} placeholder="e.g. Office — 14 Lavelle Road" className={inputClass("onBlue", "h-11 px-3.5")} />
          </label>
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {places.map((p) => (
              <button key={p} type="button" onClick={() => set("pickupLocation", p)} className="hit-44 h-7 rounded-pill border-0 bg-white/16 px-2.5 text-[11px] text-white hover:bg-white/26">
                {p}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Booked by</span>
            <select value={form.bookedForId} onChange={(e) => set("bookedForId", e.target.value)} className={inputClass("onBlue", "h-11 cursor-pointer px-3")}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <FormError message={error} tone="onBlue" />
          <Button variant="white" size="lg" className="w-full" onClick={submit} loading={book.pending}>
            Book cab
          </Button>
        </section>

        <div className="grid grid-cols-3 gap-2">
          {[
            ["Today", stats.today],
            ["Upcoming", stats.upcoming],
            ["All bookings", stats.all],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 rounded-[20px] bg-card p-3.5 shadow-raised">
              <span className="text-xs text-muted">{k}</span>
              <span className="text-[28px] font-light">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <SectionTitle title="Bookings" meta="Newest first · visible to everyone" />
      {rows.length === 0 ? (
        <EmptyState className="rounded-card bg-card">No bookings yet. Book the first cab above.</EmptyState>
      ) : (
        <RowTable label="Cab bookings" minWidth={1480} columns={COLUMNS}>
          <RowHead>
            <HeadCell>Sl. No.</HeadCell>
            <HeadCell>Booked by</HeadCell>
            <HeadCell>Client</HeadCell>
            <HeadCell>Type of car</HeadCell>
            <HeadCell>Date</HeadCell>
            <HeadCell>Time</HeadCell>
            <HeadCell>Pick-up location</HeadCell>
            <HeadCell>Booked on</HeadCell>
            <HeadCell>Status</HeadCell>
            <HeadCell />
          </RowHead>
          {rows.map((r, i) => {
            const st = CAB_STATUS[r.status];
            return (
              <Row key={r.id} id={`cab-${r.id}`} highlighted={fresh === r.id} style={{ opacity: r.status === "CANCELLED" ? 0.55 : 1 }}>
                <Cell className="text-muted">{i + 1}</Cell>
                <Cell className="flex items-center gap-2.5">
                  <Avatar initials={r.bookedFor.initials} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{r.bookedFor.name}</span>
                    <span className="truncate text-[11px] text-muted">{r.bookedFor.role}</span>
                  </span>
                </Cell>
                <Cell className="truncate">{r.clientName}</Cell>
                <Cell>{CAR_TYPES.find((c) => c.value === r.carType)?.label}</Cell>
                <Cell>{formatDate(r.date)}</Cell>
                <Cell>{formatTime12(r.time)}</Cell>
                <Cell className="truncate">{r.pickupLocation}</Cell>
                <Cell className="text-xs text-muted">{r.bookedOn}</Cell>
                <Cell>
                  <StatusPill color={st.color}>{st.label}</StatusPill>
                </Cell>
                <Cell className="flex justify-end gap-1.5">
                  {r.canConfirm && (
                    <Button size="sm" disabled={status.pending} onClick={() => void status.run({ id: r.id, status: "CONFIRMED" })}>
                      Confirm
                    </Button>
                  )}
                  {r.canComplete && (
                    <Button size="sm" disabled={status.pending} onClick={() => void status.run({ id: r.id, status: "COMPLETED" })}>
                      Complete
                    </Button>
                  )}
                  {r.canCancel && (
                    <button type="button" onClick={() => setCancelling(r)} className="hit-44 h-[30px] rounded-pill border-0 bg-chip-2 px-3 text-xs text-danger hover:bg-white">
                      Cancel
                    </button>
                  )}
                </Cell>
              </Row>
            );
          })}
        </RowTable>
      )}

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel this cab?"
        body={cancelling ? `${CAR_TYPES.find((c) => c.value === cancelling.carType)?.label} for ${cancelling.bookedFor.name} · ${cancelling.clientName}, ${formatDate(cancelling.date)} at ${formatTime12(cancelling.time)}.` : ""}
        confirmLabel="Cancel cab"
        pending={status.pending}
        onConfirm={() => cancelling && void status.run({ id: cancelling.id, status: "CANCELLED" })}
        onClose={() => setCancelling(null)}
      />
    </Page>
  );
}
