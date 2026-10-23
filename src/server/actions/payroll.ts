"use server";

import { refresh } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { ok } from "@/lib/action-result";
import { addDaysIso, isoDateIST, isoToDate } from "@/lib/dates";
import { formatINR, toPaise } from "@/lib/money";
import { computePayslip, longMonthLabel, monthEnd } from "@/lib/payroll";
import { payslipEditSchema, runIdSchema, startRunSchema } from "@/lib/schemas/payroll";
import { writeAudit } from "../audit";
import { companyProfile } from "../company";
import { db } from "../db";
import { documentEmail } from "../email/templates";
import { env } from "../env";
import { has } from "../policy";
import { enqueue, QUEUES } from "../queue";
import { notify } from "../services/notify";
import { componentsOf, generatePayslips, nextRunPeriod } from "../services/payroll";
import { defineAction, UserError } from "./define";

const canRun = (user: Parameters<typeof has>[0]) => has(user, "payroll.run");

export const startPayrollRunAction = defineAction({
  schema: startRunSchema,
  authorize: canRun,
  handler: async ({ user, input, meta }) => {
    const next = await nextRunPeriod();
    if (!next) throw new UserError("Finish the open payroll run before starting the next one");
    if (input.period !== next.period) throw new UserError(`The next run is ${longMonthLabel(next.period)}`);
    if (input.payDate < `${input.period}-01` || input.payDate > addDaysIso(monthEnd(input.period), 10)) {
      throw new UserError("Pick a pay date in the month or within 10 days after it", { payDate: "Out of range" });
    }
    const label = longMonthLabel(input.period);
    const run = await db.$transaction(async (tx) => {
      const created = await tx.payrollRun.create({ data: { period: input.period, payDate: isoToDate(input.payDate), createdById: user.id } });
      const count = await generatePayslips(tx, created.id, input.period);
      if (!count) throw new UserError("Nobody is on payroll yet — set CTCs in Teams first");
      await writeAudit(tx, { actor: user, module: "Payroll", action: "create", text: `${user.name} opened the ${label} payroll run (${count} employees)`, entityType: "PayrollRun", entityId: created.id, after: input, meta, visibility: "PRIVATE" });
      return created;
    });
    refresh();
    return ok(`${label} payroll opened for review`, { id: run.id });
  },
});

async function reviewRun(runId: string) {
  const run = await db.payrollRun.findUnique({ where: { id: runId } });
  if (!run) throw new UserError("That payroll run no longer exists");
  if (run.status !== "REVIEW") throw new UserError("This run has been approved — payslips can no longer change");
  return run;
}

export const updatePayslipAction = defineAction({
  schema: payslipEditSchema,
  authorize: canRun,
  handler: async ({ user, input, meta }) => {
    const slip = await db.payslip.findUnique({ where: { id: input.id }, include: { user: { select: { name: true, ctcAnnualPaise: true } } } });
    if (!slip) throw new UserError("That payslip no longer exists");
    const run = await reviewRun(slip.runId);
    const before = componentsOf(slip.components);
    const next = computePayslip({
      period: run.period,
      ctcAnnualPaise: toPaise(slip.user.ctcAnnualPaise),
      daysPaid: before.daysPaid,
      commission: input.commissionPaise,
      incentive: input.incentivePaise,
      other: input.otherPaise,
      tdsOverride: input.tdsPaise,
      note: input.note,
    });
    const { gross, deductions, net, ...components } = next;
    if (net < 0) throw new UserError("Deductions are more than the gross pay");
    await db.$transaction(async (tx) => {
      await tx.payslip.update({
        where: { id: slip.id },
        data: { grossPaise: BigInt(gross), deductionsPaise: BigInt(deductions), netPaise: BigInt(net), onHold: input.onHold, components: components as unknown as Prisma.InputJsonValue },
      });
      await writeAudit(tx, {
        actor: user,
        module: "Payroll",
        action: "update",
        text: `${user.name} updated ${slip.user.name}'s ${longMonthLabel(run.period)} payslip${input.onHold ? " (on hold)" : ""}`,
        entityType: "Payslip",
        entityId: slip.id,
        before: { ...before, onHold: slip.onHold },
        after: { ...components, onHold: input.onHold },
        meta,
        visibility: "PRIVATE",
      });
    });
    refresh();
    return ok(`${slip.user.name} · net ${formatINR(net)}${input.onHold ? " · on hold" : ""}`);
  },
});

export const recalculateRunAction = defineAction({
  schema: runIdSchema,
  authorize: canRun,
  handler: async ({ user, input, meta }) => {
    const run = await reviewRun(input.id);
    const count = await db.$transaction(async (tx) => {
      const n = await generatePayslips(tx, run.id, run.period);
      await writeAudit(tx, { actor: user, module: "Payroll", action: "update", text: `${user.name} recalculated the ${longMonthLabel(run.period)} payroll from current CTCs`, entityType: "PayrollRun", entityId: run.id, meta, visibility: "PRIVATE" });
      return n;
    });
    refresh();
    return ok(`Recalculated ${count} payslips from current CTCs`);
  },
});

export const approvePayrollAction = defineAction({
  schema: runIdSchema,
  authorize: canRun,
  handler: async ({ user, input, meta }) => {
    const run = await reviewRun(input.id);
    const live = await db.payslip.findMany({ where: { runId: run.id, onHold: false }, select: { netPaise: true } });
    if (!live.length) throw new UserError("Every payslip is on hold — nothing to approve");
    const net = live.reduce((a, p) => a + toPaise(p.netPaise), 0);
    await db.$transaction(async (tx) => {
      const changed = await tx.payrollRun.updateMany({ where: { id: run.id, status: "REVIEW" }, data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() } });
      if (!changed.count) throw new UserError("Someone else just changed this run. Refresh and try again.");
      await writeAudit(tx, { actor: user, module: "Payroll", action: "approve", text: `${user.name} approved the ${longMonthLabel(run.period)} payroll · ${formatINR(net)} net`, entityType: "PayrollRun", entityId: run.id, meta, visibility: "PRIVATE" });
    });
    refresh();
    return ok(`Payroll approved · ${formatINR(net)}`);
  },
});

export const disbursePayrollAction = defineAction({
  schema: runIdSchema,
  authorize: canRun,
  handler: async ({ user, input, meta }) => {
    const run = await db.payrollRun.findUnique({ where: { id: input.id }, include: { payslips: { where: { onHold: false }, include: { user: { select: { id: true, name: true, email: true } } } } } });
    if (!run) throw new UserError("That payroll run no longer exists");
    if (run.status !== "APPROVED") throw new UserError(run.status === "DISBURSED" ? "This run has already been disbursed" : "Approve the run before disbursing it");
    const label = longMonthLabel(run.period);
    const gross = run.payslips.reduce((a, p) => a + toPaise(p.grossPaise), 0);
    const net = run.payslips.reduce((a, p) => a + toPaise(p.netPaise), 0);
    const company = companyProfile();
    await db.$transaction(async (tx) => {
      const changed = await tx.payrollRun.updateMany({ where: { id: run.id, status: "APPROVED" }, data: { status: "DISBURSED", disbursedById: user.id, disbursedAt: new Date() } });
      if (!changed.count) throw new UserError("Someone else just changed this run. Refresh and try again.");
      // Salary cost (gross) goes to the ledger as the Salaries expense for the Finance overview.
      await tx.ledgerEntry.create({
        data: {
          type: "EXPENSE",
          category: "Salaries",
          description: `Salaries — ${label} payroll`,
          party: `${run.payslips.length} employee${run.payslips.length === 1 ? "" : "s"}`,
          mode: "NEFT",
          amountPaise: BigInt(gross),
          entryDate: isoToDate(isoDateIST()),
          payrollRunId: run.id,
          createdById: user.id,
        },
      });
      await writeAudit(tx, {
        actor: user,
        module: "Payroll",
        action: "update",
        text: `${user.name} disbursed the ${label} payroll · ${formatINR(net)} to ${run.payslips.length} employees`,
        entityType: "PayrollRun",
        entityId: run.id,
        after: { grossPaise: gross, netPaise: net, employees: run.payslips.length },
        meta,
        visibility: "PRIVATE",
      });
      await notify(tx, run.payslips.map((p) => p.userId), { kind: "payroll", text: `Your ${label} payslip is ready`, href: "/payroll" }, user.id);
      for (const p of run.payslips) {
        const mail = documentEmail({
          greetingName: p.user.name.split(" ")[0]!,
          heading: `Your payslip for ${label}`,
          lines: [`Your salary for ${label} has been paid. Net pay: ${formatINR(toPaise(p.netPaise))}.`, "Your payslip is attached as a PDF. You can also download it any time from Payroll in Pat Michaels OS."],
          footnote: `${company.legalName} · this payslip is confidential.`,
        });
        await enqueue(
          QUEUES.email,
          {
            to: p.user.email,
            subject: `Payslip for ${label} — ${company.legalName}`,
            html: mail.html,
            text: mail.text,
            replyTo: env().COMPANY_EMAIL,
            attachments: [{ kind: "payslip-pdf", userId: p.userId, periodType: "MONTHLY", period: run.period }],
            audit: { module: "Payroll", entityType: "Payslip", entityId: p.id },
          },
          { tx },
        );
      }
    });
    refresh();
    return ok(`${formatINR(net)} disbursed to ${run.payslips.length} employees · payslips emailed`);
  },
});
