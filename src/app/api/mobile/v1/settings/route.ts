import { mobileRoute } from "@/server/mobile/http";
import { settingsView } from "@/server/mobile/views";

/** Settings tabs: ?tab=general|roles|integrations|audit (+ fy, q, module, before), same as /settings. */
export const GET = mobileRoute(({ user, url }) => settingsView(user, url.searchParams));
