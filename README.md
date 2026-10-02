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
| `ANTHROPIC_API_KEY` | no | Enables the Research Assistant chat, Claude-written morning briefs and Ask lumen answers, and Claude-assisted brand import. Insights, briefs, common Ask questions and brand import still work without it |
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

## What's here (Phase 8: Polish, performance, accessibility)
- **Automated audit:** axe-core (WCAG 2.0/2.1/2.2 A + AA rules) across 23 screens and states: landing,
  sign-in, Studio home, editor (every tab, dialogs open), dashboard, research, experiments, orders,
  payments, pay pages (idle, error, success, survey) and 404. It went from 22 violations to **0**.
- **Keyboard walk:** every interactive element on the landing (46 stops), editor (63) and dashboard (72)
  is reachable in a sensible order with a visible focus ring. There's a skip link on every page.
- **Contrast fixes:** primary buttons are now ink on orange (5.2:1; white on orange was 3.7:1). The
  dashboard heat map uses 5 discrete steps with automatically chosen cell text, plus a legend.
- **Structure:** one `<h1>` per screen (the editor has a screen-reader-only "Editing …" heading),
  no skipped heading levels, all content inside landmarks, and branded `not-found` and error pages.
- **Performance:** mobile Lighthouse on the landing dropped to 84 because the hero subtitle, the real
  LCP element, faded in from transparent. It now rises without fading, so LCP lands on first paint.
  The live editor demo below the fold loads only when the visitor scrolls near it.
- **Hosted logos:** publishing copies a checkout's logo into lumen (`Asset` table, served from
  `/assets/<id>`). Live checkouts never hot-link a merchant's server, and a logo can't change or vanish
  under a live sale. Fetches go through the SSRF-hardened client. The file type is sniffed from the bytes
  (PNG, JPEG, GIF, WebP, ICO, or SVG without scripts), with a 512 KB cap. Files are served with
  `nosniff` and a sandboxing CSP. If the copy fails, publishing stops with a message instead of
  silently dropping the logo.

## The Home dashboard (`/studio`)
The first screen a merchant sees. The aim is calm: one glance tells you how the shop is doing and the
one thing worth fixing.

**Sections, in default order:** morning brief → revenue (North Star, orange area chart vs the previous
period) → four KPI tiles (orders, conversion, average order value, refund and dispute rate, each with a
delta and a monochrome sparkline) → checkout funnel (Visit → Start → Details → Payment → Paid, biggest
leak in orange, click a step to drill into device, source, new vs returning and order value) → live
sales → "Why they buy" → the current experiment, in plain English. "Ask lumen" docks at the bottom.

**Design tokens: one file.** Every color, radius, shadow, type size and motion timing lives in
`src/styles/theme.css` as `--app-*` custom properties, with light and dark values and the contrast ratio
of each pairing noted next to it. Tailwind utilities (`bg-app-card`, `text-app-muted`, `text-figure`…)
are generated from them via `@theme inline`. Orange is reserved for the primary action, the selected nav
item, the main chart series and the single biggest problem; status colors only ever mean status, always
with an icon or word. Dark mode follows the system and can be pinned with the toggle in the top bar
(`lumen_theme` cookie, so there's no flash on load). Older app pages are remapped to the same tokens.

**Global filters.** The top bar's date range (7, 30 or 90 days) lives in the URL (`?range=`), so it's
shareable and works with back and forward. Every comparison is like-for-like: the previous period ends at
the same time of day, so a half-finished today is never compared with a full day.

**Rearranging and saved views.** "Customize" lets a merchant reorder sections with up and down buttons
(no drag needed, so it works from the keyboard and announces each move), hide sections, and save the
layout plus date range as a named view (up to 8). It's stored per merchant (`Merchant.homeLayout`,
`Merchant.homeViews`) and validated on read and write (`src/lib/home-layout.ts`). It's a viewing
preference, so it works on sample data too.

**Morning brief.** The facts (yesterday vs the same weekday last week, and the biggest drop-off with who,
where and a conservative weekly value) are computed in SQL. With `ANTHROPIC_API_KEY`, Claude writes the
sentence from those facts only; any dollar amount it writes that isn't in the facts gets the sentence
rejected, and the template is used instead. It's written once per local day (`MorningBrief`). On day one
it greets the first sale instead of saying "no sales yesterday". "What this is based on" shows the facts.

**Ask lumen.** Questions go to Claude with the same read-only research tools as the Research Assistant,
plus funnel and traffic-source tools. The answer is a short narrative, an optional small chart (direct
labels), "How I calculated this" (the actual tool calls, recorded server-side) and one next action, often
"Start a test" in one click. Without an API key, common questions (revenue, devices, drop-off, sources,
survey answers) are answered directly from the data. Each question is saved as a research thread.

**First run and sample data.** Until their first sale, a new merchant sees the demo shop's numbers,
clearly labelled "Sample data" and strictly read-only (no tests can be started, no proposals). They can
turn it off on Home or in Settings, which shows a 4-step checklist instead (publish, connect Stripe,
share your link, first sale), never empty charts. The first sale gets a full-screen celebration, then
Home switches to the merchant's own numbers. The seeded demo shop (Kiln & Co.) tells a story: a launch
spike 24 days ago, mobile shoppers dropping off at shipping, and a $48 → $52 price test that won.

**Alerts** appear only for things that need action: a spike in failed payments, a new dispute, or a
payout problem. Each can be dismissed.

**Motion.** Skeletons match each card's final size (no layout shift); cards rise in 40ms apart; big
numbers count up over about 600ms; chart lines draw in. All of it is CSS or a single
`requestAnimationFrame`, and `prefers-reduced-motion` turns every bit of it off. New sales slide into the
live feed; no confetti there.

**Accessibility and speed.** Every chart has a screen-reader summary (the revenue chart also has "Show as table");
the gist is in visible text, so hover is never needed. axe reports 0 violations on every app page in light
and dark. The Payments and Customers tables (up to 500 rows) are virtualized with TanStack Virtual: only
the rows near the viewport are mounted, while the table keeps real rows and `aria-rowcount`. Home's data
comes from several small, parallel, merchant-scoped endpoints (`/api/app/*`); in a production build the
page is complete in about half a second.

## Accessibility
- WCAG AA contrast: button label colors are picked automatically, and accent-as-text is darkened
  until it passes 4.5:1 (`ensureContrast`), so merchants can't pick an illegible theme.
- Every control is a native input with a label. Drag-and-drop works from the keyboard
  (focus a ⋮⋮ handle, press Space, use the arrow keys, then Space again), with screen-reader announcements.
- `prefers-reduced-motion` is honored by both CSS animations and Framer Motion (`MotionConfig reducedMotion="user"`).
- Every chart has a table twin and an arrow-key readout. Color is never the only signal: arrows, labels
  and legends always come with it.
- axe-core finds 0 violations across 23 screens and states (see Phase 8).

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
| Landing, desktop | 100 | 100 | 100 | 100 |
| Landing, mobile (simulated slow 4G) | 92–94 | 100 | 100 | 100 |
| Pay page, desktop | 100 | 100 | 100* | 60† |
| Pay page, mobile | 94–96 | 100 | 100* | 60† |

\* 96 in our sandbox, only because it blocks `js.stripe.com`. With network access that console error is gone.
† On purpose: checkout pages send `robots: noindex` so buyers' private links never end up in search results.

Desktop LCP is 0.7s on every page. On mobile, LCP lands on first paint (about 0.4s observed with 4× CPU
throttling). The hero animates with CSS transforms only, never from transparent, so it paints before hydration.
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
8. ✅ Polish, performance, accessibility
