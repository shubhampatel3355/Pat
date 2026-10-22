import "server-only";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { getSessionUser } from "../auth/session";
import { logger } from "../logger";
import { ForbiddenError, type SessionUser } from "../policy";
import { isSameOrigin, metaFromHeaders, type RequestMeta } from "../request";
import type { ActionResult } from "@/lib/action-result";

/** A user-facing failure (validation, business rule) — its message is shown in the toast. */
export class UserError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "UserError";
  }
}

export interface ActionContext<I> {
  user: SessionUser;
  input: I;
  meta: RequestMeta;
}

interface ActionConfig<S extends z.ZodType, R> {
  schema: S;
  /**
   * Coarse permission check (must call `can()`); record-level checks happen in the handler with
   * `assertCan()` once the record is loaded. Required so no action ships without an authorisation step.
   */
  authorize: (user: SessionUser, input: z.infer<S>) => boolean | Promise<boolean>;
  handler: (ctx: ActionContext<z.infer<S>>) => Promise<ActionResult<R>>;
  /** Allowed while the user still has to change their first-login password. */
  allowPasswordChange?: boolean;
}

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

export function defineAction<S extends z.ZodType, R = undefined>(config: ActionConfig<S, R>) {
  return async (input: z.input<S>): Promise<ActionResult<R>> => {
    try {
      const h = await headers();
      if (!isSameOrigin(h)) return { ok: false, error: "Request blocked (cross-site)." };

      const user = await getSessionUser();
      if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };
      if (user.mustChangePassword && !config.allowPasswordChange) {
        return { ok: false, error: "Change your password to continue." };
      }

      const parsed = config.schema.safeParse(input);
      if (!parsed.success) {
        const fieldErrors = fieldErrorsOf(parsed.error);
        return { ok: false, error: Object.values(fieldErrors)[0] ?? "Check the form and try again.", fieldErrors };
      }

      if (!(await config.authorize(user, parsed.data))) {
        return { ok: false, error: "You don't have access to do that." };
      }

      return await config.handler({ user, input: parsed.data, meta: metaFromHeaders(h) });
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof UserError) return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
      if (error instanceof ForbiddenError) return { ok: false, error: error.message };
      logger.error({ err: error instanceof Error ? { message: error.message, stack: error.stack } : error }, "server action failed");
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  };
}
