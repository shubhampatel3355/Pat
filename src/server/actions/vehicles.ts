"use server";

import { refresh } from "next/cache";
import { ok } from "@/lib/action-result";
import { CAB_STATUS, CAR_TYPES } from "@/lib/constants";
import { dateToIso, formatDayMonth, formatTime12, isoDateIST, isoToDate, timeIST } from "@/lib/dates";
import { cabBookingInputSchema, cabStatusInputSchema } from "@/lib/schemas/vehicles";
import { writeAudit } from "../audit";
import { db } from "../db";
import { assertCan, can, has } from "../policy";
import { managerIds, notify } from "../services/notify";
import { defineAction, UserError } from "./define";

const carLabel = (v: string) => CAR_TYPES.find((c) => c.value === v)?.label ?? v;

export const bookCabAction = defineAction({
  schema: cabBookingInputSchema,
  authorize: (user) => can(user, "create", { type: "cab" }),
  handler: async ({ user, input, meta }) => {
    if (input.pickupDate < isoDateIST()) throw new UserError("Pick today or a later date", { pickupDate: "In the past" });
    if (input.pickupDate === isoDateIST() && input.pickupTime < timeIST(new Date())) throw new UserError("That time has already passed today — pick a later time", { pickupTime: "Already passed" });
    const person = await db.user.findFirst({ where: { id: input.bookedForId, active: true, deletedAt: null }, select: { id: true, name: true } });
    if (!person) throw new UserError("Pick who the cab is for");
    const when = `${formatDayMonth(input.pickupDate)}, ${formatTime12(input.pickupTime)}`;
    const booking = await db.$transaction(async (tx) => {
      const created = await tx.cabBooking.create({
        data: {
          carType: input.carType,
          clientName: input.clientName,
          pickupDate: isoToDate(input.pickupDate),
          pickupTime: input.pickupTime,
          pickupLocation: input.pickupLocation,
          bookedForId: person.id,
          createdById: user.id,
        },
      });
      await writeAudit(tx, {
        actor: user,
        module: "Vehicles",
        action: "create",
        text: `${user.name} booked a ${carLabel(input.carType)} for ${person.id === user.id ? "themselves" : person.name} · ${input.clientName}, ${when}`,
        entityType: "CabBooking",
        entityId: created.id,
        after: input,
        meta,
        visibility: "PUBLIC",
        feed: true,
      });
      const managers = await managerIds(tx);
      await notify(tx, [...managers, person.id], { kind: "cab", text: `Cab requested: ${carLabel(input.carType)} for ${person.name} · ${input.clientName}, ${when}`, href: `/vehicles?focus=${created.id}` }, user.id);
      return created;
    });
    refresh();
    return ok(`${carLabel(input.carType)} booked for ${input.clientName} · ${when}`, { id: booking.id });
  },
});

const NEXT: Record<string, string[]> = { REQUESTED: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["COMPLETED", "CANCELLED"] };

export const setCabStatusAction = defineAction({
  schema: cabStatusInputSchema,
  authorize: (user, input) => (input.status === "CANCELLED" ? can(user, "create", { type: "cab" }) : has(user, "vehicles.manage")),
  handler: async ({ user, input, meta }) => {
    const before = await db.cabBooking.findUnique({ where: { id: input.id }, include: { bookedFor: { select: { name: true } } } });
    if (!before) throw new UserError("That booking no longer exists");
    assertCan(user, input.status === "CANCELLED" ? "delete" : "update", { type: "cab", bookedForId: before.bookedForId, createdById: before.createdById });
    if (!NEXT[before.status]?.includes(input.status)) throw new UserError(`This booking is already ${CAB_STATUS[before.status].label.toLowerCase()}`);

    const label = CAB_STATUS[input.status].label.toLowerCase();
    await db.$transaction(async (tx) => {
      const changed = await tx.cabBooking.updateMany({ where: { id: before.id, status: before.status }, data: { status: input.status, statusChangedById: user.id, statusChangedAt: new Date() } });
      if (!changed.count) throw new UserError("Someone else just changed this booking. Refresh and try again.");
      await writeAudit(tx, {
        actor: user,
        module: "Vehicles",
        action: "update",
        text: `${user.name} ${label} the cab for ${before.bookedFor.name} · ${before.clientName}`,
        entityType: "CabBooking",
        entityId: before.id,
        before: { status: before.status },
        after: { status: input.status },
        meta,
        visibility: "PUBLIC",
      });
      await notify(tx, [before.bookedForId, before.createdById], { kind: "cab", text: `Your cab for ${before.clientName} (${formatDayMonth(dateToIso(before.pickupDate))}) was ${label}`, href: `/vehicles?focus=${before.id}` }, user.id);
    });
    refresh();
    return ok(`Cab for ${before.bookedFor.name} ${label}`);
  },
});
