import { mobileRoute } from "@/server/mobile/http";
import { payrollView } from "@/server/mobile/views";

/** Latest payroll run and employees (same as /payroll). */
export const GET = mobileRoute(({ user }) => payrollView(user));
