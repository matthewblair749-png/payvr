/**
 * Content-Security-Policy builder.
 *
 * - Scripts: nonce + 'strict-dynamic' (Next.js applies the nonce automatically
 *   when it finds it on the request's CSP header). No third-party scripts.
 * - Styles: 'unsafe-inline' is required for React style attributes (chart
 *   geometry, animation variables). Style injection cannot execute code.
 * - Billing redirects to Stripe Checkout are top-level navigations, which
 *   CSP doesn't restrict, so no Stripe hosts are needed here.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(isDev ? ["ws:"] : [])],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    ...(isDev ? {} : { "upgrade-insecure-requests": [] }),
  };
  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}
