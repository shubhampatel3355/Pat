import { mobileRoute } from "@/server/mobile/http";
import { vehiclesView } from "@/server/mobile/views";

/** Cab bookings (same as /vehicles). */
export const GET = mobileRoute(({ user }) => vehiclesView(user));
