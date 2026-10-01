# lumen

**The checkout that learns.** Stripe-grade payments for solo creators and small brands, with a
drag-and-drop checkout studio and a built-in research assistant.

> Status: **Phase 7 of 8 complete.** Landing page, the Checkout Studio, Stripe Connect payments (test mode), checkout analytics with a dashboard, the one-tap survey, the Research Assistant, and the Experiment Lab.

## Quick start

```bash
npm install                     # also runs `prisma generate`
cp .env.example .env            # then set AUTH_SECRET (openssl rand -base64 32)
docker compose up -d            # Postgres 16 on :5432 (or point DATABASE_URL at your own)
npm run db:migrate              # create tables
npm run db:seed                 # demo merchant + checkouts
npm run dev                     # http://localhost:3000
```

The seed also generates about 90 days of realistic checkout history for the demo merchant: roughly 43k events,
3.5k orders and 1.4k survey answers. It is deterministic, so every run produces the same data.

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
| `ANTHROPIC_API_KEY` | no | Enables the Research Assistant chat and Claude-assisted brand import. Insights and brand import still work without it |
| `LUMEN_AI_MODEL` | no | Defaults to `claude-opus-5-5` |
| `STRIPE_SECRET_KEY` | for payments | `sk_test_…` only; live keys are refused |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | for payments | `pk_test_…` only |
| `STRIPE_WEBHOOK_SECRET` | for payments | `whsec_…` from `stripe listen` or your endpoint |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | no | If Connect events go to a separate endpoint |
| `LUMEN_PLATFORM_FEE_BPS` | no | Platform fee in basis points; default 0 |

## Payments setup (Stripe test mode)

1. In the Stripe dashboard, switch to **Test mode** and enable **Connect** (Settings → Connect).
2. Copy the test keys into `.env` (see the table above).
3. Forward webhooks locally with the [Stripe CLI](https://docs.stripe.com/stripe-cli):
   ```bash
   stripe listen \
     --forward-to localhost:3000/api/stripe/webhook \
     --forward-connect-to localhost:3000/api/stripe/webhook
   ```
   Put the `whsec_…` it prints in `STRIPE_WEBHOOK_SECRET` and restart `npm run dev`.
4. In the Studio, go to **Payments → Connect with Stripe** and complete Stripe's test onboarding
   (use test data; the "Use test phone number / SSN" shortcuts work).
5. Publish a checkout, open `/pay/<slug>`, and pay with a test card (below).
   Your first successful payment triggers the full-screen first-sale celebration in the Studio.

Deployed: add a webhook endpoint at `https://<your-domain>/api/stripe/webhook` listening for
`payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.succeeded`, `charge.refunded`,
`charge.dispute.created`, `charge.dispute.closed` and (Connect events) `account.updated`.

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

## What's here (Phase 3: Payments)

| Area | Where |
| --- | --- |
| Stripe client, test-mode guard, platform fee | `src/server/stripe.ts` |
| Connect Express onboarding, status, dashboard link | `src/server/payments/connect.ts`, `src/app/studio/(home)/payments/*` |
| Server-side pricing shared with the UI | `src/lib/checkout/pricing.ts` |
| PaymentIntent preparation (hosted checkout) | `src/server/payments/checkout.ts`, `src/app/pay/[slug]/actions.ts` |
| Payment Element themed to each checkout | `src/components/checkout/live-checkout.tsx` |
| Webhooks (signature-verified, idempotent) | `src/app/api/stripe/webhook/route.ts`, `src/server/payments/webhooks.ts` |
| Orders + refunds | `src/server/dal/orders.ts`, `src/app/studio/(home)/orders/*` |
| Product/price sync to Stripe | `src/server/payments/catalog.ts` |
| Success screen, haptics, chime | `src/components/checkout/success-check.tsx`, `src/lib/checkout/celebrate.ts` |
| First-sale celebration | `src/components/studio/first-sale-celebration.tsx` |

**Money flow:** destination charges. The PaymentIntent is created on the lumen platform with
`on_behalf_of` and `transfer_data.destination` set to the merchant's Express account, so the merchant is
the settlement merchant and funds land in their balance. Refunds use `reverse_transfer`, and
`refund_application_fee` returns any platform fee.

**Pay flow:** the Payment Element renders immediately using Stripe's deferred-intent mode. On Pay, the
browser sends only the buyer's *choices* (add-on on/off, tip %, coupon code). The server re-resolves the
published config and the visitor's A/B variant, recomputes the amount with the shared pricing module, and
creates (or, on retry, updates) the PaymentIntent with an idempotency key. If the server's amount ever
differs from what the buyer saw, nothing is charged and the buyer is asked to review. Card data only ever
lives in Stripe's iframes.

**Webhooks:** the signature is verified against the raw body. Each event id is stored in `StripeEvent`
in the same transaction as its effects, so a duplicate delivery is a no-op and a failure rolls back and
lets Stripe retry. Transitions are guarded against out-of-order delivery (a late `payment_failed` can't
undo a success). Coupon codes are defined per checkout in the coupon block and checked on the server.

## What's here (Phase 4: Tracking + dashboard)

| Area | Where |
| --- | --- |
| Event vocabulary (steps, fields, schemas) | `src/lib/tracking/events.ts` |
| Browser tracker (~1KB, batching, sendBeacon, honors GPC/DNT) | `src/lib/tracking/tracker.ts` |
| Ingest endpoint | `src/app/api/events/route.ts` |
| Hosted checkout instrumentation | `src/components/checkout/hosted-checkout.tsx` |
| Analytics queries | `src/server/dal/analytics.ts` |
| Dashboard | `src/app/studio/(home)/dashboard/*`, `src/components/dashboard/*` |
| Demo history generator | `prisma/seed-analytics.ts` |

**What's tracked:** checkout views, which block or field a buyer touched (by name, never what they
typed), funnel steps (viewed → interacted → started payment → pressed pay → paid), pay clicks, and an
abandon event when the tab is hidden or closed. `PAYMENT_SUCCEEDED` and `PAYMENT_FAILED` come only from
verified Stripe webhooks, so revenue numbers can't be spoofed from a browser. The ingest endpoint works out
the merchant, device (from User-Agent) and country (from a CDN geo header, when present) on the server,
accepts a variant only if it belongs to that page's running experiment, de-dupes views, and is
rate-limited. Buyers with Global Privacy Control or Do Not Track enabled aren't tracked.

**Dashboard (`/studio/dashboard`):**
- KPI tiles (net revenue, orders, conversion, average order) with change against the previous period.
- Separate revenue and conversion charts, so there's never a dual axis.
- A conversion funnel.
- A drop-off heatmap showing the last thing touched before leaving, by device, as an exit rate.
- A payment-success grid by country and method.
- One-tap survey answers.
- A per-checkout table.

One filter row (7/30/90 days, checkout) scopes everything. Every chart has a keyboard-readable tooltip
and a "Show as table" twin. A single aggregation pass per session keeps the whole dashboard around
100ms on the seeded data.

Known limits: days are UTC (merchant time zones come later), and revenue is reported in the
merchant's default currency only. The dashboard is designed for desktop.

## What's here (Phase 5: One-tap survey)

| Area | Where |
| --- | --- |
| Questions and answers (stable keys, labels) | `src/lib/survey/questions.ts` |
| Buyer component (themed, animated, one tap) | `src/components/checkout/one-tap-survey.tsx` |
| Server validation and storage | `src/server/survey.ts`, `answerSurveyAction` in `src/app/pay/[slug]/actions.ts` |
| Studio "Survey" tab, with a thank-you screen preview | `src/components/studio/survey-panel.tsx` |

Each checkout config has `survey: { enabled, question }`, which is on by default and asks "What nearly
stopped you?". Configs saved before this field existed get the default when they're read. After payment,
the thank-you screen shows the question as chips styled with the checkout's own theme. Buyers can tap
once or press "No thanks", it never blocks them, and it respects reduced motion and the checkout's
haptics setting. It also appears on the redirect return page (3-D Secure, bank redirects).

**Anti-spam without accounts:** an answer is stored only if the checkout actually asks that question,
the answer is one of its options, the browser session has a real order (PENDING counts, because the
payment webhook may still be in flight), and it's that session's first answer
(`@@unique([sessionId, question])`). Each answer also records the order and A/B variant, so later
phases can compare answers across variants. On the landing demo and in Studio previews, answers stay
local.

## What's here (Phase 6: Research Assistant)

| Area | Where |
| --- | --- |
| Research tools (8 read-only, merchant-scoped queries + `propose_experiment`) | `src/server/research/tools.ts` |
| Proposals: allowed changes, apply/validate, one-click start | `src/server/research/proposals.ts` |
| "lumen noticed" insight engine (deterministic) | `src/server/research/insights.ts` |
| Claude agent loop (streaming, tool use, persisted threads) | `src/server/research/agent.ts`, `src/app/api/research/chat/route.ts` |
| Research page | `src/app/studio/(home)/research/page.tsx`, `src/components/research/*` |

**Two layers:**
1. **lumen noticed** (no AI key needed): deterministic detectors find the biggest recent conversion dip
   and explain it by device and payment method, the block that loses the most people, the top survey
   objection, payment methods failing in a country, and A/B tests with a leader. Some insights carry a
   ready-to-start experiment.
2. **Research Assistant** (needs `ANTHROPIC_API_KEY`): plain-English questions answered by Claude
   (`claude-opus-5-5` by default, override with `LUMEN_AI_MODEL`) using the same tools. Answers stream to
   the browser along with "what I checked" steps. When a change is worth testing, Claude calls
   `propose_experiment` and the merchant gets a card with **Start this test**.

**How it's built:**
- **Tools are the only data access.** Each is a zod schema plus a merchant-scoped query. Claude's tool
  definitions are generated from those schemas, every model-supplied input is re-validated before
  running, and breakdown dimensions come from a fixed list rather than from model text. All 8 tools return
  in under 70ms on the seed data.
- **The agent loop** streams through the beta Messages API with `eager_input_streaming` on each tool. It
  handles `refusal`, `max_tokens`, `pause_turn` and malformed tool input (which goes back as an `is_error`
  result). Server-side fallback is on (`fallbacks: "default"`), so a safeguard decline re-runs on a
  suitable model instead of failing.
- **Conversation history** is stored exactly as the API returns it (thinking, text, tool and fallback
  blocks), only ever appended, and replayed verbatim, which preserved thinking requires. Shop context goes
  in the first user message, so the system prompt stays identical across requests and can be cached.
- **Proposals** are a closed set of changes: hide/show/move a block, set the price, change the theme, set
  the pay-button label, set the trust badges. A dry run validates the full config before a proposal is
  stored, and only a merchant's click starts one (`startProposal`). Starting creates a 50/50 experiment,
  one per checkout at a time. Price tests set `Variant.priceCents`, which the checkout resolver applies to
  both the displayed price and the server-side PaymentIntent.

## What's here (Phase 7: Experiment Lab)

| Area | Where |
| --- | --- |
| Statistics + plain-language verdicts | `src/lib/experiments/stats.ts` |
| "What B changes" describer | `src/lib/experiments/diff.ts` |
| Results, ship/keep/stop | `src/server/dal/experiments.ts`, `src/app/studio/experiment-actions.ts` |
| Lab pages | `src/app/studio/(home)/experiments/*`, `src/components/experiments/*` |

**Results without jargon.** Each test gets one sentence, such as "B is very likely better: about +5.8 sales
per 100 visitors (somewhere between +1.7 and +10)", plus a "chance B beats your original" meter with a 95%
ship line and a likely-difference bar drawn around "no change".
- Conversion tests use a Beta-Binomial model with 20,000 seeded samples, so the same data always gives the
  same numbers.
- Price tests compare revenue per visitor (including visitors who didn't buy) with a normal approximation,
  and the verdict includes a monthly projection.
- Guardrails: at least 7 days and 100 visits per version before any verdict; a "no real difference" call
  when the whole likely range sits within ±1 sale per 100; a days-left estimate; and a warning when traffic
  isn't splitting as configured (sample-ratio check).

**Controls:** *Ship B to everyone* publishes B's design (and, for price tests, the new product price,
synced to Stripe) as a new version. *Keep the original* and *Stop test* end the test without changing the
checkout. The Research Assistant's `get_experiment_results` tool and the "lumen noticed" insight use the
same results and verdicts, so chat, insights and the Lab always agree. The seed includes one running test
(B ahead) and one finished test (original kept).

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

## Stripe test cards
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
3. ✅ Stripe Connect + published checkout
4. ✅ Event tracking + dashboard
5. ✅ One-tap survey
6. ✅ Research Assistant
7. ✅ Experiments
8. Polish, performance, accessibility
