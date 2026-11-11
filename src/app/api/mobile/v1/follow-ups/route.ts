import { mobileRoute } from "@/server/mobile/http";
import { followUpsView } from "@/server/mobile/views";

/** Follow-ups and tasks (same as /follow-ups). */
export const GET = mobileRoute(({ user }) => followUpsView(user));
