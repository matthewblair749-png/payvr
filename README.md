# lumen

**The checkout that learns.** Stripe-grade payments for solo creators and small brands, with a
drag-and-drop checkout studio and a built-in research assistant.

> Status: **Phase 2 of 8 complete.** Landing page plus the Checkout Studio: a block editor, versions, publishing, A/B variants and brand import.

## Quick start

```bash
npm install                     # also runs `prisma generate`
cp .env.example .env            # then set AUTH_SECRET (openssl rand -base64 32)
docker compose up -d            # Postgres 16 on :5432 (or point DATABASE_URL at your own)
npm run db:migrate              # create tables
npm run db:seed                 # demo merchant + checkouts
npm run dev                     # http://localhost:3000
```

**Sign in:** go to `/studio` and enter `demo@lumen.test` (the seeded merchant), or any email address.
Without `EMAIL_SERVER` set, the magic link appears on the "Check your inbox" screen and in the
server console. That shortcut is disabled in production.

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests (vitest) |
| `npm run lint` / `typecheck` | ESLint / tsc |
| `npm run db:migrate` / `db:seed` / `db:reset` | Prisma |

Requires Node 20+ and Postgres 14+.

## Environment variables

| Var | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `AUTH_SECRET` | yes | Auth.js signing secret |
| `NEXT_PUBLIC_APP_URL` | yes | Base URL shown in publish links |
| `EMAIL_SERVER`, `EMAIL_FROM` | prod | SMTP URL for magic links |
| `ANTHROPIC_API_KEY` | no | Enables Claude for brand import (falls back to heuristics without it) |
| `LUMEN_AI_MODEL` | no | Defaults to `claude-opus-5-5` |

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

## What's here (Phase 2: Checkout Studio)

| Area | Where |
| --- | --- |
| Data model (all phases) | `prisma/schema.prisma` |
| Auth.js magic links, DB sessions | `src/server/auth.ts`, `src/server/email.ts`, `src/app/login/*` |
| Merchant-scoped data access | `src/server/dal/*` (every query filters by `merchantId`) |
| Server actions (auth → rate limit → zod → DAL) | `src/app/studio/actions.ts` |
| Studio home + editor | `src/app/studio/**`, `src/components/studio/*` |
| Brand import (SSRF-safe fetch → signals → heuristics → Claude) | `src/server/brand-import/*`, `src/lib/brand/*` |
| Hosted checkout `/pay/[slug]` with sticky A/B assignment | `src/app/pay/[slug]`, `src/server/dal/public-checkout.ts`, `src/lib/checkout/assign.ts` |
| Seed data | `prisma/seed.ts` |

**Editor:** layers (drag, hide, delete, click to edit), block inspector, add-block palette, theme,
product, and import tabs. Live phone and desktop preview (click a block in the preview to edit it),
undo/redo (⌘Z / ⇧⌘Z), autosave, versions (save, restore), publish with a custom slug, and an A/B
variant with a traffic split. On phones the editor switches between Edit and Preview tabs.

**Drafts vs published:** the Studio autosaves to `CheckoutPage.draftConfig`. Publishing snapshots it
into an immutable `CheckoutPageVersion`, and buyers only ever see published versions. Variant B lives on
`Variant.config` and is snapshotted to `Variant.publishedConfig` on publish, which also starts the
experiment. Visitors get a first-party `lumen_vid` cookie, and `hash(experiment, visitor)` picks their
variant, so assignment is sticky without a database write per view.

**Brand import:** paste a website or Instagram URL. The server fetches the page (SSRF-hardened:
public IPs only, checked at DNS-connect time, manual redirect re-validation, size and time caps), extracts
theme-color, CSS colors (brand-named CSS variables weighted up), fonts, radii, and logo candidates, then
maps them to a theme. With `ANTHROPIC_API_KEY`, Claude refines the result from those signals plus the
logo image, using structured output. If Claude fails or the request is refused, it falls back to the heuristic result.

## Accessibility
- WCAG AA contrast: button label colors are picked automatically, and accent-as-text is darkened
  until it passes 4.5:1 (`ensureContrast`), so merchants can't pick an illegible theme.
- Every control is a native input with a label. Drag-and-drop works from the keyboard
  (focus a ⋮⋮ handle, press Space, use the arrow keys, then Space again), with screen-reader announcements.
- `prefers-reduced-motion` is honored by both CSS animations and Framer Motion (`MotionConfig reducedMotion="user"`).

## Security
- **Row-level access by merchant:** every DAL function takes `merchantId` from the session and filters on it.
  Ids from the client are never trusted on their own.
- **Rate limits:** per-merchant sliding windows on saves, mutations and brand import; per-address on magic
  links (`src/server/rate-limit.ts`). These are in-memory, so swap in Redis for multi-instance deploys.
- **Input validation:** zod on every server action; configs are re-validated before they're written.
- **SSRF protection** for brand import (see above). **No open redirects** after sign-in (`safeNext`).
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
2. ✅ Studio with live preview (versions, publish, A/B variants, brand import)
3. Stripe Connect + published checkout
4. Event tracking + dashboard
5. One-tap survey
6. Research Assistant
7. Experiments
8. Polish, performance, accessibility
