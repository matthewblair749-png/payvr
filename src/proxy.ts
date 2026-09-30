import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/security/csp";

const VISITOR_COOKIE = "lumen_vid";

/**
 * Runs before every page render: issues a fresh CSP nonce per request.
 * Static headers (HSTS, nosniff, …) live in next.config.ts.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  // Anonymous, first-party visitor id for hosted checkouts: keeps A/B
  // assignment sticky. Set on the request too, so the very first render sees it.
  let newVisitorId: string | null = null;
  if (request.nextUrl.pathname.startsWith("/pay/") && !request.cookies.get(VISITOR_COOKIE)) {
    newVisitorId = crypto.randomUUID();
    request.cookies.set(VISITOR_COOKIE, newVisitorId);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (newVisitorId) {
    response.cookies.set(VISITOR_COOKIE, newVisitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  return response;
}

export const config = {
  matcher: [
    {
      // Skip API routes (webhooks etc.), static assets and prefetches.
      source: "/((?!api|_next/static|_next/image|icon.svg|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
