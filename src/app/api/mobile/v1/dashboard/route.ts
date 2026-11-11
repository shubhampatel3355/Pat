import { mobileRoute } from "@/server/mobile/http";
import { dashboardView } from "@/server/mobile/views";

/** Dashboard (same data as /dashboard). ?view=company or a partner id (owners and admins). */
export const GET = mobileRoute(({ user, url }) => dashboardView(user, url.searchParams.get("view") ?? "company"));
