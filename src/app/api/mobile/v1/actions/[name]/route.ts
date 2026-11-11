import { mobileAction } from "@/server/mobile/actions";
import { runForMobile } from "@/server/mobile/context";
import { mobileRoute, NotFoundError, readJson } from "@/server/mobile/http";

/**
 * Runs one of the web's server actions for the app (see src/server/mobile/actions.ts for the list). The result is
 * the action's own { ok, message, data } or { ok: false, error, fieldErrors }.
 */
export const POST = mobileRoute<{ name: string }>(async ({ params, req }) => {
  const action = mobileAction(params.name);
  if (!action) throw new NotFoundError("Unknown action.");
  const input = await readJson(req);
  return runForMobile(() => action(input as never));
});
