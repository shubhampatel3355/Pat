import { shouldRenew, issueMobileToken, verifyMobileToken } from "@/server/auth/mobile-token";
import { mobileRoute } from "@/server/mobile/http";
import { meView } from "@/server/mobile/views";
import { bearerToken } from "@/server/request";

/**
 * Who is signed in, what they may open (the web sidebar's filter) and server facts (today in IST, app URL).
 * Also renews the token once it is a day old, so people who keep using the app stay signed in.
 */
export const GET = mobileRoute(
  async ({ user, req }) => {
    const claims = verifyMobileToken(bearerToken(req.headers) ?? "");
    const session = claims && shouldRenew(claims) ? issueMobileToken({ id: user.id, sessionVersion: claims.sv }) : null;
    return { ...(await meView(user)), session };
  },
  { allowPasswordChange: true },
);
