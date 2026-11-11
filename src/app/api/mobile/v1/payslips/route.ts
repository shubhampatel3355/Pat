import { mobileRoute } from "@/server/mobile/http";
import { payslipsView } from "@/server/mobile/views";

/** Own payslips and incentive (same as /payslips). */
export const GET = mobileRoute(({ user }) => payslipsView(user));
