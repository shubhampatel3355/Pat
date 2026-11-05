"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { LeadTemperature } from "@/generated/prisma/enums";
import { MEETING_MODES, MEETING_TYPES, TEMPERATURE, TEMPERATURES, tint } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { setBdCommentAction, setBdTemperatureAction } from "@/server/actions/bd";
import type { BdRowDto } from "@/server/services/bd";
import type { UserOption } from "@/server/services/wip";
import { Avatar, EmptyState } from "../ui/bits";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { Page, PageHeader } from "../ui/page";
import { Cell, HeadCell, Row, RowHead, RowTable } from "../ui/row-table";
import { useAction } from "../ui/toast";
import { useDeepLink, useFreshRow } from "../ui/use-deep-link";
import { BdDrawer } from "./bd-drawer";

const COLUMNS = "150px 150px 110px minmax(170px,1fr) 150px 140px 200px 120px 140px 120px 300px";
const TYPE_LABEL = Object.fromEntries(MEETING_TYPES.map((t) => [t.value, t.label]));
const MODE_LABEL = Object.fromEntries(MEETING_MODES.map((m) => [m.value, m.label]));

interface BdScreenProps {
  rows: BdRowDto[];
  users: UserOption[];
  me: string;
  today: string;
  canSeeContacts: boolean;
}

export function BdScreen({ rows, users, me, today, canSeeContacts }: BdScreenProps) {
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState<{ open: boolean; row: BdRowDto | null }>(() => ({ open: params.get("new") === "1", row: null }));
  const [fresh, setFresh] = useFreshRow(params.get("focus"));
  useDeepLink("/business-development", "bd");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.tenantName, r.contactName, r.primary.name, r.secondary?.name ?? ""].join(" ").toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <Page>
      <PageHeader
        title="Business Development"
        actions={
          <>
            <label className="flex h-10 items-center gap-2 rounded-pill bg-surface px-3.5 shadow-inset focus-within:shadow-focus">
              <Icon name="search" size={15} color="var(--color-muted)" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tenant, contact, broker" aria-label="Search meetings" className="w-[180px] border-0 bg-transparent text-[13px] outline-none" />
            </label>
            <Button onClick={() => setDrawer({ open: true, row: null })}>+ New Meeting</Button>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState className="rounded-card bg-card">No meetings yet. Log the first one with New Meeting.</EmptyState>
      ) : (
        <RowTable label="Business development meetings" minWidth={1960} columns={COLUMNS}>
          <RowHead>
            <HeadCell>Broker Name</HeadCell>
            <HeadCell>Secondary Broker</HeadCell>
            <HeadCell>Date</HeadCell>
            <HeadCell>Tenant Name</HeadCell>
            <HeadCell>Contact Name</HeadCell>
            <HeadCell>Client Designation</HeadCell>
            <HeadCell>
              <span className="inline-flex items-center gap-1.5">
                Client Contact Info <Icon name="lock" size={12} />
              </span>
            </HeadCell>
            <HeadCell>Meeting Type</HeadCell>
            <HeadCell>Lead Temperature</HeadCell>
            <HeadCell>Meeting Mode</HeadCell>
            <HeadCell>Comments</HeadCell>
          </RowHead>
          {visible.map((r) => (
            <Row key={r.id} id={`bd-${r.id}`} highlighted={fresh === r.id} className="min-h-[68px] py-2 hover:shadow-hover">
              <Cell className="flex items-center gap-2">
                <Avatar initials={r.primary.initials} size={26} ring={false} />
                <span className="truncate">{r.primary.name}</span>
              </Cell>
              <Cell className="flex items-center gap-2">
                {r.secondary ? <Avatar initials={r.secondary.initials} size={26} ring={false} /> : <Avatar initials="" size={26} tone="dashed" />}
                <span className={r.secondary ? "truncate" : "text-muted"}>{r.secondary?.name ?? "—"}</span>
              </Cell>
              <Cell>{formatDate(r.date)}</Cell>
              <Cell>
                {r.canEdit ? (
                  <button type="button" onClick={() => setDrawer({ open: true, row: r })} className="max-w-full truncate border-0 bg-transparent p-0 text-left text-sm text-ink hover:text-link hover:underline">
                    {r.tenantName}
                  </button>
                ) : (
                  <span className="block truncate text-sm">{r.tenantName}</span>
                )}
              </Cell>
              <Cell className="truncate">{r.contactName}</Cell>
              <Cell className="truncate text-muted">{r.designation ?? "—"}</Cell>
              <Cell>
                {r.contact ? (
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{r.contact.phone ?? "—"}</span>
                    <span className="truncate text-[11px] text-muted">{r.contact.email ?? ""}</span>
                  </span>
                ) : (
                  <span title="Visible to Admin and Owners only" className="inline-flex h-7 items-center gap-1.5 rounded-pill bg-chip-2 px-3 text-xs text-muted">
                    <Icon name="lock" size={12} /> Restricted
                  </span>
                )}
              </Cell>
              <Cell>{TYPE_LABEL[r.meetingType]}</Cell>
              <Cell>
                <TemperatureSelect key={`${r.id}-${r.temperature}`} id={r.id} value={r.temperature} disabled={!r.canEdit} />
              </Cell>
              <Cell>{MODE_LABEL[r.mode]}</Cell>
              <Cell>
                <CommentBox key={`${r.id}-${r.comments}`} id={r.id} value={r.comments} disabled={!r.canEdit} />
              </Cell>
            </Row>
          ))}
          {visible.length === 0 && <EmptyState>No meetings match.</EmptyState>}
        </RowTable>
      )}

      <BdDrawer
        open={drawer.open}
        row={drawer.row}
        users={users}
        me={me}
        today={today}
        canSeeContacts={canSeeContacts}
        onClose={() => setDrawer({ open: false, row: null })}
        onSaved={(id) => {
          setDrawer({ open: false, row: null });
          setFresh(id);
        }}
      />
    </Page>
  );
}

/** Inline temperature pill (prototype: tinted select with a coloured dot). */
function TemperatureSelect({ id, value, disabled }: { id: string; value: LeadTemperature; disabled: boolean }) {
  const [temp, setTemp] = useState(value);
  const action = useAction(setBdTemperatureAction, { onError: () => setTemp(value) });
  const t = TEMPERATURE[temp];
  return (
    <span className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 h-[7px] w-[7px] rounded-pill" style={{ background: t.color }} />
      <select
        aria-label="Lead temperature"
        value={temp}
        disabled={disabled || action.pending}
        onChange={(e) => {
          const next = e.target.value as LeadTemperature;
          setTemp(next);
          void action.run({ id, temperature: next });
        }}
        className="h-[34px] w-full cursor-pointer appearance-none rounded-pill border-0 py-0 pl-[26px] pr-7 text-xs font-medium text-ink outline-none focus:shadow-focus disabled:cursor-default"
        style={{ background: tint(t.color) }}
      >
        {TEMPERATURES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={12} className="pointer-events-none absolute right-3" />
    </span>
  );
}

/** Inline comments: saved when the box loses focus. */
function CommentBox({ id, value, disabled }: { id: string; value: string; disabled: boolean }) {
  const [text, setText] = useState(value);
  const action = useAction(setBdCommentAction);
  return (
    <textarea
      aria-label="Comments"
      rows={2}
      value={text}
      readOnly={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text.trim() !== value.trim()) void action.run({ id, comments: text });
      }}
      placeholder={disabled ? "" : "Add comments"}
      className="block h-[52px] w-full resize-none rounded-[12px] border-0 bg-field px-2.5 py-2 text-xs leading-4 shadow-inset outline-none focus:shadow-focus"
    />
  );
}
