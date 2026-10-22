import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page request:
 *  1. Content-Security-Policy with a fresh nonce (Next.js applies it to its own scripts).
 *  2. Optimistic auth redirect: no session cookie → /login. The real check happens in the
 *     (app) layout and in every action / route handler (requireUser / getSessionUser).
 */

const PUBLIC_PATHS = ["/login", "/forgot-password", "/set-password", "/print"];
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

function csp(nonce: string, isDev: boolean): string {
  const google = process.env.AUTH_GOOGLE_ID ? " https://accounts.google.com" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // React style attributes carry dynamic values (widths, colours); scripts remain nonce-only.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self'${google}`,
    "frame-ancestors 'none'",
    ...(process.env.APP_URL?.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = pathname === "/" ? false : PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));

  if (!isPublic && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" || pathname === "/dashboard" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Lets the root layout render /print/* pages bare (no intro, white page).
  requestHeaders.set("x-pm-path", pathname);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|brand|favicon.ico|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
