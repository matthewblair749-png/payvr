import type { NextConfig } from "next";

/** Security headers applied to every response (CSP is per-request in src/proxy.ts). */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Payment Request API is needed for Apple Pay / Google Pay via Stripe.
  { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Inline Tailwind's small atomic stylesheet into <head>: removes a
    // render-blocking request, which matters for first-time checkout buyers.
    inlineCss: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
