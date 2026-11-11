import { mobileRoute } from "@/server/mobile/http";
import { invoicesView } from "@/server/mobile/views";

/** Invoices, proformas and form data (same as /invoices). ?lead=<id> prefills from a WIP row. */
export const GET = mobileRoute(({ user, url }) => invoicesView(user, url.searchParams.get("lead")));
