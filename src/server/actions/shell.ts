"use server";

import { cookies } from "next/headers";
import { refresh } from "./refresh";
import { z } from "zod";
import { ok } from "@/lib/action-result";
import { signOut } from "../auth/config";
import { db } from "../db";
import { env } from "../env";
import { isAdminOrOwner } from "../policy";
import { VIEW_COOKIE } from "../view";
import { defineAction } from "./define";

export const setViewAction = defineAction({
  schema: z.object({ view: z.union([z.literal("company"), z.uuid()]) }),
  authorize: (user) => isAdminOrOwner(user),
  allowPasswordChange: true,
  handler: async ({ input }) => {
    if (input.view !== "company") {
      const partner = await db.user.findFirst({ where: { id: input.view, role: "OWNER", active: true } });
      if (!partner) return { ok: false, error: "Unknown partner." };
    }
    (await cookies()).set(VIEW_COOKIE, input.view, {
      httpOnly: true,
      sameSite: "lax",
      secure: env().APP_URL.startsWith("https://"),
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
    refresh();
    return ok();
  },
});

export const markNotificationsReadAction = defineAction({
  schema: z.object({ ids: z.array(z.uuid()).max(200).optional() }),
  authorize: () => true, // only ever touches the caller's own notifications
  allowPasswordChange: true,
  handler: async ({ user, input }) => {
    await db.notification.updateMany({
      where: { userId: user.id, readAt: null, ...(input.ids ? { id: { in: input.ids } } : {}) },
      data: { readAt: new Date() },
    });
    return ok();
  },
});

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
