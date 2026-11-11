import { mobileRoute } from "@/server/mobile/http";
import { financeView } from "@/server/mobile/views";

/** Finance overview and recent ledger entries for ?fy=2026 (same as /finance). */
export const GET = mobileRoute(({ user, url }) => financeView(user, Number(url.searchParams.get("fy"))));
