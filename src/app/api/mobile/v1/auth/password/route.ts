import { changePasswordAction } from "@/server/actions/auth";
import { issueMobileToken } from "@/server/auth/mobile-token";
import { db } from "@/server/db";
import { runForMobile } from "@/server/mobile/context";
import { mobileRoute, readJson } from "@/server/mobile/http";

/**
 * Change password (also the forced first-login change): the web's own action, then a fresh token, because
 * the change signs out every other session — on the web and in the app.
 */
export const POST = mobileRoute(
  async ({ user, req }) => {
    const input = await readJson(req);
    const result = await runForMobile(() => changePasswordAction(input as never));
    if (!result.ok) return result;
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { sessionVersion: true } });
    return { ...result, session: issueMobileToken({ id: user.id, sessionVersion: fresh.sessionVersion }) };
  },
  { allowPasswordChange: true },
);
