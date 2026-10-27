"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { tint } from "@/lib/constants";
import { formatDayMonth } from "@/lib/dates";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/finance";
import { PAYMENT_MODES } from "@/lib/invoice";
import { formatCompactINR, formatINR, parseRupeesToPaise } from "@/lib/money";
import { addLedgerEntryAction, voidLedgerEntryAction } from "@/server/actions/finance";
import { EmptyState } from "../ui/bits";
import { Button, IconButton } from "../ui/button";
import { FormError, inputClass } from "../ui/field";
import { Icon } from "../ui/icon";
import { Presence } from "../ui/motion";
import { Modal } from "../ui/overlay";
import { Page, PageHeader, SectionTitle } from "../ui/page";
import { Cell, HeadCell, Row, RowHead, RowTable } from "../ui/row-table";
import { ChoiceChips, Segmented } from "../ui/segmented";
import { useAction } from "../ui/toast";
import { useDismiss } from "../ui/use-dismiss";
import { useDownload } from "../ui/use-download";
import { KpiCard, type KpiCardData } from "./kpi-card";

type EntryType = "INCOME" | "EXPENSE";
type Mode = (typeof PAYMENT_MODES)[number]["value"];

export interface EntryRow {
  id: string;
  type: EntryType;
  date: string;
  description: string;
  category: string;
  party: string | null;
  mode: Mode;
  amountPaise: number;
  /** Manual entries only; receipts from invoice payments and payroll postings are owned by those modules. */
  voidable: boolean;
}

interface FinanceScreenProps {
  fy: number;
  years: { value: number; label: string }[];
  periodLabel: string;
  cards: KpiCardData[];
  entries: EntryRow[];
  today: string;
  initialEntry: EntryType | null;
  can: { record: boolean; export: boolean };
}

const MODE_LABEL = Object.fromEntries(PAYMENT_MODES.map((m) => [m.value, m.label])) as Record<Mode, string>;

export function FinanceScreen({ fy, years, periodLabel, cards, entries, today, initialEntry, can }: FinanceScreenProps) {
  const router = useRouter();
  const [entry, setEntry] = useState<EntryType | null>(initialEntry);
  const [voiding, setVoiding] = useState<EntryRow | null>(null);
  const closeEntry = () => {
    setEntry(null);
    if (initialEntry) router.replace(`/finance${fy === years[0]?.value ? "" : `?fy=${fy}`}`, { scroll: false });
  };

  return (
    <Page>
      <PageHeader
        title="Finance"
        meta={periodLabel}
        actions={
          <>
            {years.length > 1 && (
              <select
                aria-label="Financial year"
                value={fy}
                onChange={(e) => router.push(Number(e.target.value) === years[0]?.value ? "/finance" : `/finance?fy=${e.target.value}`)}
                className="hit-44 h-10 cursor-pointer rounded-pill border-0 bg-surface px-4 text-[13px] shadow-raised outline-none focus:shadow-focus"
              >
                {years.map((y) => (
                  <option key={y.value} value={y.value}>
                    {y.label}
                  </option>
                ))}
              </select>
            )}
            {can.record && (
              <Button variant="surface" icon="plus" onClick={() => setEntry("EXPENSE")}>
                Add entry
              </Button>
            )}
            {can.export && <ExportMenu fy={fy} />}
          </>
        }
      />

      <div className="pm-stagger grid grid-cols-1 gap-4 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-3">
        {cards.map((c) => (
          <KpiCard key={c.title} {...c} />
        ))}
      </div>

      <div className="mt-2 flex flex-col gap-3">
        <SectionTitle title="Recent entries" meta="Latest receipts and expenses in this financial year" />
        {entries.length === 0 ? (
          <EmptyState>{can.record ? "No ledger entries yet. Record an expense with Add entry; invoice payments appear here automatically." : "No ledger entries yet."}</EmptyState>
        ) : (
          <RowTable label="Recent ledger entries" minWidth={860} columns={`84px minmax(240px,2fr) 140px minmax(120px,1fr) 80px 130px${can.record ? " 44px" : ""}`}>
            <RowHead>
              <HeadCell>Date</HeadCell>
              <HeadCell>Description</HeadCell>
              <HeadCell>Category</HeadCell>
              <HeadCell>Party</HeadCell>
              <HeadCell>Mode</HeadCell>
              <HeadCell align="right">Amount</HeadCell>
              {can.record && <HeadCell />}
            </RowHead>
            {entries.map((e) => {
              const income = e.type === "INCOME";
              return (
                <Row key={e.id} className="min-h-[52px]">
                  <Cell className="text-muted">{formatDayMonth(e.date)}</Cell>
                  <Cell className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-pill text-[13px]"
                      style={{ background: income ? tint("#3E9B52") : "var(--color-chip-2)", color: income ? "#3E9B52" : "var(--color-muted)" }}
                    >
                      {income ? "↓" : "↑"}
                    </span>
                    <span className="truncate">{e.description}</span>
                  </Cell>
                  <Cell>
                    <span className="inline-flex h-6 items-center rounded-pill bg-card px-2.5 text-[11px] font-medium">{e.category}</span>
                  </Cell>
                  <Cell className="truncate text-muted">{e.party ?? "—"}</Cell>
                  <Cell className="text-muted">{MODE_LABEL[e.mode]}</Cell>
                  <Cell align="right" className={income ? "text-success" : undefined}>
                    {income ? "+" : "−"} {formatINR(e.amountPaise)}
                  </Cell>
                  {can.record && (
                    <Cell align="right">{e.voidable && <IconButton icon="close" label={`Void “${e.description}”`} size={28} tone="chip" onClick={() => setVoiding(e)} />}</Cell>
                  )}
                </Row>
              );
            })}
          </RowTable>
        )}
      </div>

      <Presence value={entry}>{(type) => <EntryModal initialType={type} today={today} onClose={closeEntry} />}</Presence>
      {voiding && <VoidModal entry={voiding} onClose={() => setVoiding(null)} />}
    </Page>
  );
}

function ExportMenu({ fy }: { fy: number }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const file = useDownload();
  const get = (format: "xlsx" | "pdf") => {
    close();
    void file.download(`/api/finance/export?fy=${fy}&format=${format}`, `Pat-Michaels-Finance.${format}`, format);
  };
  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} loading={file.pending !== null}>
        {file.pending ? "Preparing…" : "Export"}
      </Button>
      {open && (
        <div role="menu" className="glass-menu absolute right-0 top-12 z-40 flex w-[220px] origin-top-right animate-pop-in flex-col gap-0.5 rounded-[20px] p-2 shadow-glass">
          <span className="px-2.5 py-1.5 text-[11px] text-muted">Finance report</span>
          {(
            [
              ["xlsx", "Excel workbook (.xlsx)"],
              ["pdf", "PDF report"],
            ] as const
          ).map(([format, label]) => (
            <button key={format} type="button" role="menuitem" onClick={() => get(format)} className="flex h-10 items-center gap-2.5 rounded-[14px] border-0 bg-transparent px-2 text-left text-sm hover:bg-raised/70">
              <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-surface">
                <Icon name={format === "pdf" ? "print" : "download"} size={14} />
              </span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EntryModal({ initialType, today, onClose }: { initialType: EntryType; today: string; onClose: () => void }) {
  const [type, setType] = useState<EntryType>(initialType);
  const [amount, setAmount] = useState("");
  const [party, setParty] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<string>(initialType === "INCOME" ? INCOME_CATEGORIES[0] : "Marketing");
  const [mode, setMode] = useState<Mode>("NEFT");
  const [error, setError] = useState<string | null>(null);
  const action = useAction(addLedgerEntryAction, { onSuccess: onClose, onError: (r) => setError(r.error) });
  const paise = parseRupeesToPaise(amount) ?? 0;
  const categories = (type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => ({ value: c as string, label: c }));

  const switchType = (t: EntryType) => {
    setType(t);
    setCategory(t === "INCOME" ? INCOME_CATEGORIES[0] : "Marketing");
    setError(null);
  };
  const submit = () => {
    if (!paise) return setError("Enter an amount");
    if (description.trim().length < 3) return setError("Add a short description");
    if (!date || date > today) return setError("Pick a date that isn't in the future");
    void action.run({ type, amountPaise: paise, party, description, category, mode, entryDate: date });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={type === "INCOME" ? "Add income" : "Add expense"}
      subtitle="Posts to the ledger and updates the Finance overview"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={action.pending}>
            Save entry
          </Button>
        </>
      }
    >
      <Segmented
        label="Entry type"
        className="self-start"
        options={[
          { value: "INCOME", label: "Income" },
          { value: "EXPENSE", label: "Expense" },
        ]}
        value={type}
        onChange={switchType}
      />
      {type === "INCOME" && <p className="m-0 -mt-2 text-xs text-muted">Payments against invoices are recorded from Invoice → Record payment, not here.</p>}
      <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Amount</span>
          <div className="flex h-11 items-center gap-2 rounded-[14px] bg-surface px-3.5 shadow-inset focus-within:shadow-focus">
            <span className="text-sm text-muted">₹</span>
            <input data-autofocus inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ""))} className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
          </div>
          <span className="text-[11px] text-placeholder">{paise ? `${formatINR(paise)} · ${formatCompactINR(paise)}` : "Indian format, no decimals"}</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Party</span>
          <input value={party} onChange={(e) => setParty(e.target.value)} placeholder={type === "INCOME" ? "Customer or payer" : "Vendor or payee"} className={inputClass("light", "h-11 px-3.5")} />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this for?" className={inputClass("light", "h-11 px-3.5")} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Date</span>
          <input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass("light", "h-11 px-3.5")} />
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Category</span>
        <ChoiceChips label="Category" options={categories} value={category} onChange={(v) => setCategory(v)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Mode</span>
        <ChoiceChips label="Payment mode" options={PAYMENT_MODES} value={mode} onChange={(v) => setMode(v)} />
      </div>
      <FormError message={error} />
    </Modal>
  );
}

function VoidModal({ entry, onClose }: { entry: EntryRow; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const action = useAction(voidLedgerEntryAction, { onSuccess: onClose, onError: (r) => setError(r.error) });
  const submit = () => {
    if (reason.trim().length < 2) return setError("Say why this entry is being voided");
    void action.run({ id: entry.id, reason });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Void entry"
      subtitle={`${entry.type === "INCOME" ? "Income" : "Expense"} of ${formatINR(entry.amountPaise)} · ${entry.description}. It drops out of every total; the audit log keeps the original.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep entry
          </Button>
          <Button onClick={submit} loading={action.pending}>
            Void entry
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Reason</span>
        <input data-autofocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered twice" className={inputClass("light", "h-11 px-3.5")} />
      </label>
      <FormError message={error} />
    </Modal>
  );
}
