"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCompactINR } from "@/lib/money";
import type { MemberDto, MemberStatus } from "@/server/services/team";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Page, PageHeader } from "../ui/page";
import { Ring } from "../ui/ring";
import { MemberDrawer } from "./member-drawer";

const STATUS: Record<MemberStatus, [string, string]> = {
  ACTIVE: ["#3E9B52", "Active"],
  INVITED: ["#F5B73B", "Invite pending"],
  INACTIVE: ["#A8A8AD", "Deactivated"],
};

interface TeamScreenProps {
  members: MemberDto[];
  partners: { id: string; name: string }[];
  meta: string;
  quarterShort: string;
  canManage: boolean;
  canSeeCtc: boolean;
  canMakeOwner: boolean;
  canUploadDocs: boolean;
}

export function TeamScreen({ members, partners, meta, quarterShort, canManage, canSeeCtc, canMakeOwner, canUploadDocs }: TeamScreenProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [partner, setPartner] = useState<string>("ALL");
  const [drawer, setDrawer] = useState<{ open: boolean; member: MemberDto | null }>(() => {
    const focus = params.get("focus");
    const m = focus ? members.find((x) => x.id === focus) : undefined;
    return { open: Boolean(m?.canEdit), member: m ?? null };
  });
  const [fresh, setFresh] = useState<string | null>(null);

  useEffect(() => {
    if (params.has("focus")) router.replace("/teams", { scroll: false });
  }, [params, router]);
  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(null), 1400);
    return () => clearTimeout(t);
  }, [fresh]);

  const visible = members.filter((m) => partner === "ALL" || m.partnerId === partner);
  const chips = [{ id: "ALL", name: "All" }, ...partners];

  return (
    <Page>
      <PageHeader
        title="Teams"
        meta={meta}
        actions={
          <>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filter by partner">
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={partner === c.id}
                  onClick={() => setPartner(c.id)}
                  className={cn("hit-44 h-8 rounded-pill border-0 px-3 text-xs", partner === c.id ? "bg-primary text-white" : "bg-chip text-ink")}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {canManage && <Button onClick={() => setDrawer({ open: true, member: null })}>+ Add member</Button>}
          </>
        }
      />
      <div className="pm-stagger grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-2">
        {visible.map((m) => {
          const pct = m.targetPaise ? Math.min(100, Math.round((m.achievedPaise / m.targetPaise) * 100)) : 0;
          const [dot, statusLabel] = STATUS[m.status];
          const body = (
            <>
              <div className="flex items-center gap-2.5">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-pill bg-chip text-[13px] font-medium shadow-avatar">{m.initials}</span>
                <div className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="truncate text-sm font-medium">{m.name}</span>
                  <span className="truncate text-[11px] text-muted">{m.title}</span>
                </div>
                <span className="h-2 w-2 flex-none rounded-pill" style={{ background: dot }} title={statusLabel} aria-label={statusLabel} role="img" />
              </div>
              <div className="flex items-center gap-3.5">
                <Ring pct={pct} label={`${pct}% of target`}>
                  <span className="text-[15px]">{m.targetPaise ? `${pct}%` : "—"}</span>
                </Ring>
                <div className="flex flex-col gap-0.5 text-left">
                  <span className="text-xl font-light">{formatCompactINR(m.achievedPaise)}</span>
                  <span className="text-[11px] text-muted">{m.targetPaise ? `of ${formatCompactINR(m.targetPaise)} target · ${quarterShort}` : `No target set · ${quarterShort}`}</span>
                </div>
              </div>
            </>
          );
          const cls = cn(
            "flex flex-col gap-3 rounded-[20px] p-4 shadow-raised transition-transform duration-200 ease-spring hover:-translate-y-0.5",
            fresh === m.id ? "bg-primary-tint" : "bg-card",
            m.status === "INACTIVE" && "opacity-60",
          );
          return m.canEdit ? (
            <button key={m.id} type="button" onClick={() => setDrawer({ open: true, member: m })} className={cn(cls, "border-0")} aria-label={`Edit ${m.name}`}>
              {body}
            </button>
          ) : (
            <div key={m.id} className={cls}>
              {body}
            </div>
          );
        })}
        {visible.length === 0 && <div className="col-span-full p-10 text-center text-[13px] text-muted">No team members yet.</div>}
      </div>
      <MemberDrawer
        open={drawer.open}
        member={drawer.member}
        partners={partners}
        canSeeCtc={canSeeCtc}
        canMakeOwner={canMakeOwner}
        canUploadDocs={canUploadDocs}
        onClose={() => setDrawer({ open: false, member: null })}
        onSaved={(id) => {
          setDrawer({ open: false, member: null });
          if (id) setFresh(id);
        }}
      />
    </Page>
  );
}
