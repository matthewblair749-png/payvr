# lumen

**The checkout that learns.** Stripe-grade payments for solo creators and small brands, with a
drag-and-drop checkout studio and a built-in research assistant.

> Status: **Phase 1 of 8 complete.** This covers design tokens, the logo, and the landing page with a live, editable checkout.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

Production build:

```bash
npm run build && npm start
```

Requires Node 20+.

## What's here (Phase 1)

| Area | Where |
| --- | --- |
| Design tokens (colors, type, shadows, easing) | `src/app/globals.css`, `src/lib/fonts.ts` |
| Logo mark, wordmark, lockup (default + inverted) | `src/components/brand/logo.tsx`, `src/app/icon.svg` |
| Checkout config schema (zod), the single source of truth | `src/lib/checkout/schema.ts`, `meta.ts` |
| Contrast-safe theme → CSS variables | `src/lib/checkout/theme.ts`, `src/lib/color.ts` |
| Checkout renderer + 9 blocks | `src/components/checkout/*` |
| Editor primitives + drag-and-drop layers | `src/components/editor/*`, `src/lib/checkout/reducer.ts` |
| Landing page | `src/app/page.tsx`, `src/components/landing/*` |
| Security headers + per-request CSP nonce | `next.config.ts`, `src/proxy.ts`, `src/lib/security/csp.ts` |

### How the live checkout works
A checkout is just a `CheckoutConfig` JSON (theme + ordered blocks). `<CheckoutView>` renders it,
and the landing demo, the Studio and the hosted `/pay/[slug]` page all use that same component.
Theme edits only change CSS custom properties, which is why updates feel instant. Container queries
(rather than viewport breakpoints) let one component render correctly inside phone and desktop
preview frames.

**Make this mine** saves the design to `localStorage` and opens `/studio`. For now, `/studio` is a
placeholder that confirms the hand-off. The full Studio arrives in Phase 2.

Demo coupon codes: `LUMEN10` (10% off) and `HELLO` (15% off).

## Accessibility
- WCAG AA contrast: button label colors are picked automatically, and accent-as-text is darkened
  until it passes 4.5:1 (`ensureContrast`), so merchants can't pick an illegible theme.
- Every control is a native input with a label. Drag-and-drop works from the keyboard
  (focus a ⋮⋮ handle, press Space, use the arrow keys, then Space again), with screen-reader announcements.
- `prefers-reduced-motion` is honored by both CSS animations and Framer Motion (`MotionConfig reducedMotion="user"`).

## Security
- **No raw card data, ever.** Demo "card fields" are plain divs, not inputs. Live checkouts will
  use the Stripe Payment Element (Stripe-hosted iframes).
- A CSP with a per-request nonce and `'strict-dynamic'`, with no `unsafe-eval` in production.
  Zod runs in jitless mode for that reason.
- HSTS, `nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, and a strict Permissions-Policy.
- All configs are validated with zod before they're trusted.

## Performance (Lighthouse, production build, local)
| | Perf | A11y | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Desktop | 100 | 100 | 100 | 100 |
| Mobile (simulated slow 4G) | 95–97 | 100 | 100 | 100 |

The hero animates with CSS only (transform, no opacity), so the LCP wordmark paints before hydration.
Framer Motion features are lazy-loaded, and Tailwind CSS is inlined into `<head>`.

## Stripe test cards (for Phase 3+)
| Card | Result |
| --- | --- |
| `4242 4242 4242 4242` | Succeeds |
| `4000 0025 0000 3155` | Requires 3-D Secure |
| `4000 0000 0000 9995` | Declined (insufficient funds) |
| `4000 0000 0000 0259` | Succeeds, then disputed |

Use any future expiry, any CVC and any postal code.

## Roadmap
1. ✅ Design tokens, logo, landing page
2. Studio with live preview (versions, publish, A/B variants, brand import)
3. Stripe Connect + published checkout
4. Event tracking + dashboard
5. One-tap survey
6. Research Assistant
7. Experiments
8. Polish, performance, accessibility
