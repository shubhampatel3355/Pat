import { apiUrl } from "./config";

/**
 * Thin JSON client for the backend. Every request carries the session's bearer token; a 401 signs the app
 * out, and a 403 "password_change" sends the user to the change-password screen (both via handlers set by
 * the session provider).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let token: string | null = null;
let handlers: { signedOut?: (message?: string) => void; passwordChange?: () => void } = {};

export function setToken(value: string | null) {
  token = value;
}

export function getToken(): string | null {
  return token;
}

export function setAuthHandlers(next: typeof handlers) {
  handlers = next;
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  /** false: don't send the token (sign-in) and don't treat 401 as "signed out". */
  auth?: boolean;
  signal?: AbortSignal;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const auth = opts.auth !== false;
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (auth && token) headers.authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(apiUrl() + path, { method: opts.method ?? "GET", headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: opts.signal });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0, "network");
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  const body = (data ?? {}) as { error?: string; code?: string; ok?: boolean };

  if (auth && res.status === 401 && token) {
    handlers.signedOut?.(body.error);
    throw new ApiError(body.error ?? "Your session has ended. Please sign in again.", 401, "signed_out");
  }
  if (auth && res.status === 403 && body.code === "password_change") {
    handlers.passwordChange?.();
    throw new ApiError(body.error ?? "Change your password to continue.", 403, "password_change");
  }
  // A server whose web app predates the mobile API has no /api/mobile routes at all.
  if (res.status === 404 && path.startsWith("/api/mobile/") && !body.error) {
    throw new ApiError("This server doesn't support the mobile app yet. The web app needs updating to the latest version.", 404, "no_mobile_api");
  }
  // Endpoints that answer { ok: false, error } (sign-in, actions) are returned to the caller as data.
  if (!res.ok && typeof body.ok !== "boolean") {
    throw new ApiError(body.error ?? `The server answered ${res.status}. Please try again.`, res.status, body.code);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ?? {} }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** "Something went wrong" text for any thrown value. */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}
