import type { NextRequest } from "next/server";
import { WIP_REMARK } from "@/lib/constants";
import { dateToIso, formatDate, isoDateIST } from "@/lib/dates";
import { instantLabel } from "@/lib/tasks";
import { formatINR, toPaise } from "@/lib/money";
import { getApiUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { can } from "@/server/policy";
import { bdScope, followUpScope, taskScope, wipScope } from "@/server/policy/scopes";
import { searchableFiles, SLUG_BY_FOLDER } from "@/server/services/vault";

/** ⌘K search. Every group is permission-scoped server-side. */
export async function GET(req: NextRequest) {
  const user = await getApiUser();
  if (!user) return Response.json({ error: "unauthorised" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ groups: [] });
  const contains = { contains: q, mode: "insensitive" as const };

  const [leads, meetings, invoices, people, tasks, followUps, files] = await Promise.all([
    db.lead.findMany({
      where: { AND: [wipScope(user), { OR: [{ tenantName: contains }, { building: contains }, { location: contains }, { landlordName: contains }] }] },
      take: 6,
      orderBy: { updatedAt: "desc" },
      select: { id: true, tenantName: true, remark: true, location: true, building: true },
    }),
    db.bdMeeting.findMany({
      where: { AND: [bdScope(user), { OR: [{ tenantName: contains }, { contactName: contains }] }] },
      take: 5,
      orderBy: { meetingDate: "desc" },
      select: { id: true, tenantName: true, meetingDate: true, contactName: true },
    }),
    can(user, "view", { type: "invoice" })
      ? db.invoice.findMany({
          where: { OR: [{ number: contains }, { payeeName: contains }] },
          take: 5,
          orderBy: { createdAt: "desc" },
          select: { id: true, number: true, payeeName: true, totalPaise: true, type: true },
        })
      : Promise.resolve([]),
    can(user, "view", { type: "team" })
      ? db.user.findMany({ where: { deletedAt: null, OR: [{ name: contains }, { email: contains }] }, take: 5, select: { id: true, name: true, title: true, email: true } })
      : Promise.resolve([]),
    db.task.findMany({
      where: { AND: [taskScope(user), { title: contains }] },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, status: true, assignee: { select: { name: true } } },
    }),
    db.followUp.findMany({
      where: { AND: [followUpScope(user), { completedAt: null }, { OR: [{ contactName: contains }, { note: contains }] }] },
      take: 5,
      orderBy: { dueAt: "asc" },
      select: { id: true, contactName: true, note: true, dueAt: true },
    }),
    db.file.findMany({
      where: { AND: [searchableFiles(user), { name: contains }] },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, sizeBytes: true, folder: { select: { key: true, name: true } } },
    }),
  ]);
  const today = isoDateIST();

  const groups = [
    {
      label: "WIP",
      items: leads.map((l) => ({
        label: l.tenantName,
        meta: `WIP · ${WIP_REMARK[l.remark].label} · ${[l.building, l.location].filter(Boolean).join(", ")}`,
        href: `/wip?focus=${l.id}`,
        icon: "leads",
      })),
    },
    {
      label: "Meetings",
      items: meetings.map((m) => ({ label: m.tenantName, meta: `Meeting · ${formatDate(dateToIso(m.meetingDate))} · ${m.contactName}`, href: `/business-development?focus=${m.id}`, icon: "bizdev" })),
    },
    {
      label: "Invoices",
      items: invoices.map((i) => ({
        label: i.number,
        meta: `${i.type === "PROFORMA" ? "Proforma" : i.type === "CREDIT_NOTE" ? "Credit note" : "Invoice"} · ${i.payeeName} · ${formatINR(toPaise(i.totalPaise))}`,
        href: `/invoices?focus=${i.id}${i.type === "PROFORMA" ? "&mode=proforma" : ""}`,
        icon: "invoice",
      })),
    },
    { label: "People", items: people.map((p) => ({ label: p.name, meta: `${p.title ?? "Team"} · ${p.email}`, href: `/teams?focus=${p.id}`, icon: "user" })) },
    {
      label: "Tasks",
      items: tasks.map((t) => ({ label: t.title, meta: `Task · ${t.assignee.name}${t.status === "DONE" ? " · done" : ""}`, href: `/follow-ups?task=${t.id}`, icon: "followups" })),
    },
    {
      label: "Follow-ups",
      items: followUps.map((f) => ({ label: f.contactName, meta: `Follow-up · ${instantLabel(f.dueAt.toISOString(), today)}${f.note ? ` · ${f.note}` : ""}`, href: `/follow-ups?followup=${f.id}`, icon: "phone" })),
    },
    {
      label: "Documents",
      items: files.flatMap((f) => (f.folder ? [{ label: f.name, meta: `${f.folder.name}`, href: `/vault/${SLUG_BY_FOLDER[f.folder.key]}?fresh=${f.id}`, icon: "vault" }] : [])),
    },
  ].filter((g) => g.items.length);

  return Response.json({ groups }, { headers: { "cache-control": "no-store" } });
}
