/** What every server action returns; the client turns it into a toast. */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const ok = <T = undefined>(message?: string, data?: T): ActionResult<T> => ({ ok: true, message, data });
export const fail = (error: string, fieldErrors?: Record<string, string>): ActionResult<never> => ({ ok: false, error, fieldErrors });
