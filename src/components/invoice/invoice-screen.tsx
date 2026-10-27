"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CompanyProfile } from "@/lib/company";
import { tint } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { convertProformaAction, emailDocumentAction } from "@/server/actions/invoices";
import type { InvoiceListRow } from "@/server/services/invoices";
import { Icon } from "../ui/icon";
import { Presence } from "../ui/motion";
import { Page, PageHeader, SectionTitle } from "../ui/page";
import { Cell, HeadCell, Row, RowHead, RowTable } from "../ui/row-table";
import { Segmented } from "../ui/segmented";
import { useAction } from "../ui/toast";
import { useDownload } from "../ui/use-download";
import { DocViewer, type DocAction } from "./doc-viewer";
import { DocumentForm, type FormPrefill } from "./document-form";
import { CreditNoteModal, PaymentModal, PaymentsModal } from "./invoice-modals";

const INV_COLS = "150px minmax(220px,1.6fr) 170px minmax(140px,1fr) 150px 110px 120px 90px";
const PF_COLS = "150px minmax(200px,1.5fr) minmax(200px,1.4fr) 130px 130px 110px 120px 160px 90px";

interface InvoiceScreenProps {
  mode: "invoice" | "proforma";
  invoices: InvoiceListRow[];
  proformas: InvoiceListRow[];
  nextInvoice: string;
  nextProforma: string;
  today: string;
  users: { id: string; name: string }[];
  company: CompanyProfile;
  prefill: FormPrefill | null;
  can: { create: boolean; record: boolean; creditNote: boolean };
}

function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 justify-self-start whitespace-nowrap rounded-pill px-2.5 text-[11px] font-medium" style={{ background: tint(color) }}>
      <span className="h-1.5 w-1.5 rounded-pill" style={{ background: color }} />
      {label}
    </span>
  );
}

function PrintButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="hit-44 flex h-8 items-center gap-1.5 justify-self-end rounded-pill border-0 bg-chip-2 px-3.5 text-xs font-medium text-ink hover:bg-primary hover:text-white active:scale-[.97]"
    >
      <Icon name="print" size={13} strokeWidth={1.7} />
      Print
    </button>
  );
}

export function InvoiceScreen({ mode, invoices, proformas, nextInvoice, nextProforma, today, users, company, prefill: initialPrefill, can }: InvoiceScreenProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [prefill, setPrefill] = useState<FormPrefill | null>(initialPrefill);
  const [viewing, setViewing] = useState<string | null>(() => params.get("focus"));
  const [paying, setPaying] = useState<InvoiceListRow | null>(null);
  const [crediting, setCrediting] = useState<InvoiceListRow | null>(null);
  const [payments, setPayments] = useState<InvoiceListRow | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const email = useAction(emailDocumentAction);
  const pdf = useDownload();
  const convert = useAction(convertProformaAction, {
    onSuccess: (r) => {
      if (r.data?.id) setFresh(r.data.id);
      router.push("/invoices", { scroll: false });
    },
  });

  useEffect(() => {
    if (params.has("focus") || params.has("lead")) router.replace(mode === "proforma" ? "/invoices?mode=proforma" : "/invoices", { scroll: false });
  }, [params, router, mode]);
  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(null), 1400);
    return () => clearTimeout(t);
  }, [fresh]);

  const all = useMemo(() => [...invoices, ...proformas], [invoices, proformas]);
  const doc = viewing ? all.find((r) => r.id === viewing) : undefined;
  const companyState = company.gstin.slice(0, 2);

  const docActions = (row: InvoiceListRow): DocAction[] => {
    const list: DocAction[] = [];
    if (can.create) list.push({ label: "Email", onClick: () => void email.run({ id: row.id }), pending: email.pending });
    list.push({
      label: "Download PDF",
      onClick: () => void pdf.download(`/api/invoices/${row.id}/pdf`, `${row.number.replace(/\//g, "-")}.pdf`, row.id),
      pending: pdf.pending === row.id,
    });
    if (row.type === "INVOICE" && can.record && row.outstandingPaise > 0)
      list.push({
        label: "Record payment",
        onClick: () => {
          setViewing(null);
          setPaying(row);
        },
      });
    if (row.type === "INVOICE" && row.payments.length)
      list.push({
        label: `Payments (${row.payments.length})`,
        onClick: () => {
          setViewing(null);
          setPayments(row);
        },
      });
    if (row.type === "INVOICE" && can.creditNote && row.creditablePaise > 0)
      list.push({
        label: "Credit note",
        onClick: () => {
          setViewing(null);
          setCrediting(row);
        },
      });
    if (row.type === "PROFORMA" && can.create && row.rawStatus === "OPEN") list.push({ label: "Convert to invoice", onClick: () => void convert.run({ id: row.id }), pending: convert.pending });
    return list;
  };

  return (
    <Page>
      <PageHeader title="Invoice" />
      <Segmented
        label="Document type"
        value={mode}
        onChange={(m) => router.push(m === "proforma" ? "/invoices?mode=proforma" : "/invoices", { scroll: false })}
        options={[
          { value: "invoice", label: "Invoice" },
          { value: "proforma", label: "Proforma invoice" },
        ]}
      />

      {can.create && (
        <DocumentForm
          variant={mode === "invoice" ? "INVOICE" : "PROFORMA"}
          nextNumber={mode === "invoice" ? nextInvoice : nextProforma}
          today={formatDate(today)}
          users={users}
          company={company}
          prefill={prefill}
          onClearPrefill={() => setPrefill(null)}
          onCreated={(id) => {
            setFresh(id);
            router.refresh();
          }}
        />
      )}

      {mode === "invoice" ? (
        <>
          <SectionTitle title="Raised invoices" meta="Newest first" />
          <RowTable minWidth={1320} columns={INV_COLS} label="Raised invoices">
            <RowHead>
              <HeadCell>Invoice no.</HeadCell>
              <HeadCell>Payee</HeadCell>
              <HeadCell>GSTIN</HeadCell>
              <HeadCell>Payment terms</HeadCell>
              <HeadCell align="right">Total incl. GST</HeadCell>
              <HeadCell>Date</HeadCell>
              <HeadCell>Status</HeadCell>
              <HeadCell />
            </RowHead>
            {invoices.map((r) => (
              <Row key={r.id} id={`inv-${r.id}`} highlighted={fresh === r.id} onClick={() => setViewing(r.id)}>
                <Cell className="font-medium">{r.number}</Cell>
                <Cell className="flex flex-col">
                  <span className="truncate">{r.payeeName}</span>
                  <span className="truncate text-[11px] text-muted">{r.narration}</span>
                </Cell>
                <Cell className="text-xs tracking-[.03em] text-muted">{r.gstin}</Cell>
                <Cell className="truncate">{r.paymentTerms}</Cell>
                <Cell align="right">
                  {r.type === "CREDIT_NOTE" ? "−" : ""}
                  {formatINR(r.totalPaise)}
                </Cell>
                <Cell className="text-xs text-muted">{formatDate(r.issueDate)}</Cell>
                <Cell>
                  <StatusChip {...r.status} />
                </Cell>
                <Cell className="flex justify-end">
                  <PrintButton onClick={() => setViewing(r.id)} />
                </Cell>
              </Row>
            ))}
            {invoices.length === 0 && <div className="p-8 text-center text-[13px] text-muted">No invoices raised yet.</div>}
          </RowTable>
        </>
      ) : (
        <>
          <SectionTitle
            title="Proforma invoices"
            meta={`${proformas.filter((p) => p.rawStatus === "OPEN").length} open · ${proformas.filter((p) => p.rawStatus === "CONVERTED").length} converted`}
          />
          <RowTable minWidth={1420} columns={PF_COLS} label="Proforma invoices">
            <RowHead>
              <HeadCell>Proforma no.</HeadCell>
              <HeadCell>Payee</HeadCell>
              <HeadCell>Narration</HeadCell>
              <HeadCell>Valid until</HeadCell>
              <HeadCell align="right">Total incl. GST</HeadCell>
              <HeadCell>Date</HeadCell>
              <HeadCell>Status</HeadCell>
              <HeadCell />
              <HeadCell />
            </RowHead>
            {proformas.map((r) => {
              const open = r.rawStatus === "OPEN";
              return (
                <Row key={r.id} id={`pf-${r.id}`} highlighted={fresh === r.id} onClick={() => setViewing(r.id)}>
                  <Cell className="font-medium">{r.number}</Cell>
                  <Cell className="truncate">{r.payeeName}</Cell>
                  <Cell className="truncate text-muted">{r.narration}</Cell>
                  <Cell className="text-muted">{r.validUntil ? formatDate(r.validUntil) : "—"}</Cell>
                  <Cell align="right">{formatINR(r.totalPaise)}</Cell>
                  <Cell className="text-xs text-muted">{formatDate(r.issueDate)}</Cell>
                  <Cell>
                    <StatusChip {...r.status} />
                  </Cell>
                  <Cell className="flex justify-end">
                    <button
                      type="button"
                      disabled={!open || !can.create || convert.pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        void convert.run({ id: r.id });
                      }}
                      className="hit-44 h-8 whitespace-nowrap rounded-pill border-0 px-3.5 text-xs font-medium active:scale-[.97] disabled:cursor-default"
                      style={{ background: open ? "var(--color-primary)" : "var(--color-chip-2)", color: open ? "#fff" : "var(--color-muted)" }}
                      title={r.convertedToNumber ? `Converted to ${r.convertedToNumber}` : undefined}
                    >
                      {open ? "Convert to invoice" : "Converted"}
                    </button>
                  </Cell>
                  <Cell className="flex justify-end">
                    <PrintButton onClick={() => setViewing(r.id)} />
                  </Cell>
                </Row>
              );
            })}
            {proformas.length === 0 && <div className="p-8 text-center text-[13px] text-muted">No proforma invoices yet.</div>}
          </RowTable>
        </>
      )}

      {doc && <DocViewer data={doc.doc} company={company} onClose={() => setViewing(null)} actions={docActions(doc)} />}
      {paying && <PaymentModal invoice={paying} today={today} onClose={() => setPaying(null)} />}
      <Presence value={crediting}>{(invoice) => <CreditNoteModal invoice={invoice} companyStateCode={companyState} onClose={() => setCrediting(null)} />}</Presence>
      <Presence value={payments}>{(invoice) => <PaymentsModal invoice={invoice} canReverse={can.record} onClose={() => setPayments(null)} />}</Presence>
    </Page>
  );
}
