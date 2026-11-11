import { writeAudit } from "@/server/audit";
import { db } from "@/server/db";
import { mobileRoute } from "@/server/mobile/http";

/** Records the sign-out (as the web does); the app then forgets its token. */
export const POST = mobileRoute(
  async ({ user, meta }) => {
    await writeAudit(db, { actor: user, module: "Auth", action: "logout", text: `${user.name} signed out of the mobile app`, entityType: "User", entityId: user.id, meta });
    return { ok: true };
  },
  { allowPasswordChange: true },
);
