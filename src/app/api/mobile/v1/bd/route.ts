import { mobileRoute } from "@/server/mobile/http";
import { bdView } from "@/server/mobile/views";

/** Business development meetings (same as /business-development). */
export const GET = mobileRoute(({ user }) => bdView(user));
