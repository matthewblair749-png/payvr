/**
 * Content-Security-Policy builder.
 *
 * - Scripts: nonce + 'strict-dynamic' (Next.js applies the nonce automatically
 *   when it finds it on the request's CSP header). Stripe.js is allowed because
 *   the Payment Element must load from js.stripe.com — card data lives only in
 *   Stripe's iframes.
 * - Styles: 'unsafe-inline' is required for React/Framer style attributes.
 *   Style injection cannot execute code, so this is an accepted trade-off.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "https://js.stripe.com",
      "https://*.js.stripe.com",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Merchant logos can be hosted anywhere over https.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    // Stripe's documented CSP requirements for Stripe.js + Elements (incl. Link and address autocomplete).
    "connect-src": [
      "'self'",
      "https://api.stripe.com",
      "https://m.stripe.network",
      "https://merchant-ui-api.stripe.com",
      "https://maps.googleapis.com",
      ...(isDev ? ["ws:"] : []),
    ],
    "frame-src": ["https://js.stripe.com", "https://*.js.stripe.com", "https://hooks.stripe.com", "https://connect-js.stripe.com"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://connect.stripe.com"],
    "frame-ancestors": ["'none'"],
    ...(isDev ? {} : { "upgrade-insecure-requests": [] }),
  };
  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}
