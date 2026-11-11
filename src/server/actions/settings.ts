"use server";

import { refresh } from "./refresh";
import { ok } from "@/lib/action-result";
import { financialYear } from "@/lib/dates";
import { formatCompactINR } from "@/lib/money";
import { PERMISSION_DEFS, ROLE_LABELS } from "@/lib/permissions";
import { permissionToggleSchema, targetsSchema } from "@/lib/schemas/settings";
import { writeAudit } from "../audit";
import { db } from "../db";
import { can, isOwner } from "../policy";
import { invalidatePermissionCache } from "../policy/permissions";
import { defineAction, UserError } from "./define";

export const setPermissionAction = defineAction({
  schema: permissionToggleSchema,
  // Role definitions are owner-only (admins can do everything else).
  authorize: (user) => isOwner(user),
  handler: async ({ user, input, meta }) => {
    const def = PERMISSION_DEFS.find((d) => d.key === input.key)!;
    await db.$transaction(async (tx) => {
      const before = await tx.permission.findUnique({ where: { role_key: { role: input.role, key: input.key } } });
      await tx.permission.upsert({
        where: { role_key: { role: input.role, key: input.key } },
        update: { allowed: input.allowed, updatedById: user.id },
        create: { role: input.role, key: input.key, allowed: input.allowed, updatedById: user.id },
      });
      await writeAudit(tx, {
        actor: user,
        module: "Settings",
        action: "update",
        text: `${user.name} ${input.allowed ? "gave" : "took away"} “${def.label}” ${input.allowed ? "to" : "from"} ${ROLE_LABELS[input.role]}s`,
        entityType: "Permission",
        entityId: `${input.role}:${input.key}`,
        before: before ? { allowed: before.allowed } : { allowed: def.defaults[input.role] },
        after: { allowed: input.allowed },
        meta,
        visibility: "PRIVATE",
      });
    });
    invalidatePermissionCache();
    refresh();
    return ok(`${def.label} ${input.allowed ? "on" : "off"} for ${ROLE_LABELS[input.role]}s`);
  },
});

export const saveTargetsAction = defineAction({
  schema: targetsSchema,
  authorize: (user) => can(user, "update", { type: "targets" }),
  handler: async ({ user, input, meta }) => {
    const fy = financialYear(input.fy);
    const quarterKey = `${fy.key}-Q${input.quarter}`;
    const people = await db.user.findMany({ where: { active: true, deletedAt: null }, select: { id: true, role: true, name: true } });
    const roleOf = new Map(people.map((p) => [p.id, p.role]));
    const nameOf = (scope: string, key: string) => (scope === "COMPANY" ? "Company" : (people.find((p) => p.id === key)?.name ?? "Member"));

    const rows = input.entries.map((e) => {
      if (e.scope === "COMPANY" && e.scopeKey !== "company") throw new UserError("Unknown company target");
      if (e.scope === "PARTNER" && (roleOf.get(e.scopeKey) !== "OWNER" || e.metric !== "REVENUE")) throw new UserError("Partner targets are revenue targets for partners");
      if (e.scope === "USER" && (!roleOf.has(e.scopeKey) || roleOf.get(e.scopeKey) === "OWNER")) throw new UserError("One of the members is no longer active");
      // Revenue targets for the company and partners are yearly; everything else is per quarter.
      const period = e.metric === "REVENUE" && e.scope !== "USER" ? fy.key : quarterKey;
      return { ...e, period };
    });

    const changes = await db.$transaction(async (tx) => {
      const keyOf = (t: { scope: string; scopeKey: string; metric: string; period: string }) => [t.scope, t.scopeKey, t.metric, t.period].join(":");
      const existing = await tx.target.findMany({ where: { period: { in: [fy.key, quarterKey] } } });
      const currentOf = new Map(existing.map((t) => [keyOf(t), Number(t.amountPaise)]));
      const changed: { label: string; before: number | null; after: number | null }[] = [];
      for (const r of rows) {
        const current = currentOf.get(keyOf(r)) ?? null;
        if (current === r.amountPaise) continue;
        const where = { scope_scopeKey_metric_period: { scope: r.scope, scopeKey: r.scopeKey, metric: r.metric, period: r.period } };
        if (r.amountPaise === null) await tx.target.delete({ where });
        else await tx.target.upsert({ where, update: { amountPaise: BigInt(r.amountPaise) }, create: { scope: r.scope, scopeKey: r.scopeKey, metric: r.metric, period: r.period, amountPaise: BigInt(r.amountPaise) } });
        changed.push({ label: `${nameOf(r.scope, r.scopeKey)} ${r.metric === "REVENUE" ? "revenue" : "WIP fees"} ${r.period}`, before: current, after: r.amountPaise });
      }
      if (changed.length) {
        const what = changed.length <= 3 ? changed.map((c) => `${c.label} → ${c.after === null ? "cleared" : formatCompactINR(c.after)}`).join("; ") : `${changed.length} targets for ${fy.label} Q${input.quarter}`;
        await writeAudit(tx, {
          actor: user,
          module: "Settings",
          action: "update",
          text: `${user.name} set ${what}`,
          entityType: "Target",
          entityId: quarterKey,
          before: changed.map((c) => ({ target: c.label, amountPaise: c.before })),
          after: changed.map((c) => ({ target: c.label, amountPaise: c.after })),
          meta,
          visibility: "PRIVATE",
        });
      }
      return changed.length;
    });
    refresh();
    return ok(changes ? `${changes} target${changes === 1 ? "" : "s"} saved` : "No changes to save");
  },
});
