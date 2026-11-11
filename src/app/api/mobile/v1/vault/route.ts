import { mobileRoute } from "@/server/mobile/http";
import { vaultView } from "@/server/mobile/views";

/** Vault folders the user may open (same as /vault). */
export const GET = mobileRoute(({ user }) => vaultView(user));
