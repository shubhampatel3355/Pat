import { mobileRoute } from "@/server/mobile/http";
import { teamsView } from "@/server/mobile/views";

/** Team members (same as /teams). */
export const GET = mobileRoute(({ user }) => teamsView(user));
