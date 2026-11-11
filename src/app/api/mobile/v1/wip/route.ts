import { mobileRoute } from "@/server/mobile/http";
import { wipView } from "@/server/mobile/views";

/** WIP rows, quarter cards and form defaults (same as /wip). */
export const GET = mobileRoute(({ user }) => wipView(user));
