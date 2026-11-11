import "server-only";
import type { NextRequest } from "next/server";
import { getSessionUser } from "../auth/session";
import { logger } from "../logger";
import { ForbiddenError, type SessionUser } from "../policy";
import { bearerToken, metaFromHeaders, type RequestMeta } from "../request";

/**
 * Plumbing for the mobile app's API (src/app/api/mobile/v1). Every endpoint is bearer-token only: the app
 * signs in through /auth/login, and the same server-side rules (policy, scopes, services, actions) apply
 * as on the web. Responses are JSON and never cached.
 */

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export interface MobileContext<P> {
  user: SessionUser;
  req: NextRequest;
  url: URL;
  params: P;
  meta: RequestMeta;
}

type Handler<P> = (ctx: MobileContext<P>) => Promise<unknown>;

/** Wraps a handler: bearer-authenticated user (or 401), password-change gate, JSON result, errors as JSON. */
export function mobileRoute<P extends Record<string, string> = Record<string, never>>(handler: Handler<P>, opts: { allowPasswordChange?: boolean } = {}) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    if (bearerToken(req.headers) === null) return json({ error: "Sign in to the Pat Michaels app.", code: "signed_out" }, 401);
    const user = await getSessionUser();
    if (!user) return json({ error: "Your session has ended. Please sign in again.", code: "signed_out" }, 401);
    if (user.mustChangePassword && !opts.allowPasswordChange) return json({ error: "Change your password to continue.", code: "password_change" }, 403);
    try {
      const out = await handler({ user, req, url: new URL(req.url), params: await context.params, meta: metaFromHeaders(req.headers) });
      return out instanceof Response ? out : json(out);
    } catch (error) {
      if (error instanceof NotFoundError) return json({ error: error.message }, 404);
      if (error instanceof ForbiddenError) return json({ error: error.message }, 403);
      logger.error({ err: error instanceof Error ? { message: error.message, stack: error.stack } : error, path: new URL(req.url).pathname }, "mobile api failed");
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}

/** JSON request body, or null when it is missing or malformed. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
