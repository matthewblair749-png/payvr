import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/security/csp";
import { SESSION_COOKIE } from "@/lib/security/cookies";

/**
 * Runs before every page render:
 * - issues a fresh CSP nonce per request;
 * - sends visitors without a session cookie straight to /login for app
 *   routes. This is only the optimistic check; every app page and action
 *   verifies the session against the database (src/server/auth/session.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if ((pathname === "/app" || pathname.startsWith("/app/") || pathname === "/onboarding") && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Skip API routes, static files and prefetches.
      source: "/((?!api|_next/static|_next/image|icon.svg|favicon.ico|apple-icon.png|sample-data.csv).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
