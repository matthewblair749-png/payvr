# PIVOT

**Find the next move.** PIVOT turns business data into decisions: it explains what changed and why,
finds and scores opportunities, lets you simulate a decision before you make it, and ranks the
moves with the biggest impact.

`DATA → AI ANALYSIS → OPPORTUNITIES → OPTIONS → SIMULATION → NEXT MOVE`

A multi-tenant web SaaS built with Next.js 16 (App Router), Postgres + Prisma 7, and Tailwind 4.

## Quick start

```bash
cd pivot
npm install                  # also runs `prisma generate`
cp .env.example .env         # DATABASE_URL and NEXT_PUBLIC_APP_URL are all you need locally
docker compose up -d         # Postgres 16 on :5432 (or point DATABASE_URL at your own)
npm run db:migrate           # create tables
npm run db:seed              # optional: a ready-made account with sample data
npm run dev                  # http://localhost:3000
```

- **No signup:** open `/demo` to explore the full product with Northstar Commerce, a demo company.
- **Seeded login:** `demo@pivot.test` / `pivot-demo-2026` (workspace "Acme Inc." with sample data).
- **Your own account:** sign up at `/signup`, create a workspace, then upload a CSV or import sample data.

Without `EMAIL_SERVER`, password-reset and invitation links are printed to the server console and
shown on screen. That shortcut is disabled in production.

Requires Node 20.9+ and Postgres 14+.

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit and integration tests (Vitest; integration tests use `DATABASE_URL`) |
| `npm run lint` / `typecheck` | ESLint / tsc |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:reset` | Prisma |

## Environment variables

| Var | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `NEXT_PUBLIC_APP_URL` | yes | Base URL used in emailed links |
| `EMAIL_SERVER`, `EMAIL_FROM` | production | SMTP for password resets, invitations and alerts |
| `ANTHROPIC_API_KEY` | no | Enables Claude-written summaries and Ask PIVOT answers. Server-only. |
| `TRUSTED_PROXY_HOPS` | no | Proxies in front of the app that append to `x-forwarded-for` (default 1). Used for rate limits |
| `PIVOT_AI_PROVIDER` | no | `local` forces the built-in engine even when a key is set |
| `PIVOT_AI_MODEL` | no | Defaults to `claude-opus-5-5` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` | no | Payments stay off until these are set |

## What's in the product

| Area | Where |
| --- | --- |
| Landing page with a live one-slider What-If in the hero | `src/app/page.tsx`, `src/components/landing/*`, copy in `src/content/landing.ts` |
| Auth: signup, login, logout, forgot/reset password, onboarding, invitations | `src/server/auth/*`, `src/app/(auth)/*` |
| App shell, sidebar, mobile menu, Ask PIVOT panel | `src/components/app/shell.tsx`, `sidebar.tsx`, `ask-panel.tsx` |
| Overview, Business Health, Insights, Opportunities (+ PIVOT Score breakdown), What If?, Recommendations, Data, Reports, Settings | `src/components/pages/*`, routed from `src/app/app/*` and `src/app/demo/*` |
| Analytics engine (pure TypeScript) | `src/lib/engine/*` |
| Demo company generator | `src/lib/demo/northstar.ts` |
| CSV parsing, column detection, monthly aggregation | `src/lib/csv/*`, `src/server/data/upload-actions.ts` |
| AI provider layer and grounding | `src/server/ai/*`, `src/app/api/ask/route.ts` |
| Plans, entitlements, Stripe billing | `src/lib/billing/plans.ts`, `src/server/billing/*`, `src/app/api/billing/webhook/route.ts` |
| Data model | `prisma/schema.prisma` |

### The `/app` and `/demo` workspaces

Every product page is one component that takes a `Workspace`
(`src/server/workspace.ts`). `/app/*` passes the signed-in user's company (resolved from a membership
row); `/demo/*` passes the public, read-only Northstar Commerce workspace. Writes are disabled in the
demo (simulations run in the browser and aren't saved).

### How the analysis works

Nothing per company is hardcoded. For any company's monthly data, `src/lib/engine` computes:

1. **Derived metrics** (`derive.ts`): profit from revenue and costs, retention from churned or new
   customers, CAC, AOV, conversion, using whatever columns exist.
2. **Facts** (`facts.ts`): one pass that every other module reads, so the KPIs, insights,
   recommendations, summary and Ask PIVOT answers can't disagree. Includes breakdown analysis:
   the product with momentum, the most expensive marketing channel, the segment driving churn.
3. **KPIs** (`kpis.ts`) and **insights** (`insights.ts`), each answering **What? Why? So what?
   Now what?** The "why" uses breakdowns when the data has them and says what's missing when it
   doesn't.
4. **Business Health** (`health.ts`): six areas scored 0-100 with logistic curves (flat ≈ 60,
   real trouble below 40), averaged. Areas without data are listed with what would unlock them.
5. **Opportunities** (`opportunities.ts`): detectors that only fire when their signal is present,
   each sized in dollars and scored with the **PIVOT Score** (`score.ts`):
   `30% impact + 20% revenue opportunity + 20% demand + 10% market + 10% confidence + 10% cost
   efficiency`, minus penalties for risk above 35 and difficulty above 50.
6. **Recommendations** (`recommendations.ts`): ranked by annual impact × confidence, discounted for
   difficulty and risk.
7. **What If?** (`simulate.ts`): five explicit models (price with constant elasticity, marketing with
   diminishing returns, new product, new market, cost cuts). Results are monthly figures six months
   out, with every assumption and any estimated input listed. Labeled as AI estimates, not
   guaranteed outcomes.

The engine is pure and synchronous, so the browser reruns the simulator on every slider move; saving
a simulation recomputes it on the server.

When data changes, `src/server/analysis/refresh.ts` persists insights, opportunities and
recommendations keyed by stable keys, so a status your team set ("done", "dismissed") survives
re-analysis, and newly appearing "action needed" insights trigger Smart Alert emails.

### The AI layer

`src/server/ai/provider.ts` defines the provider seam. Two implementations:

- **Claude** (`anthropic.ts`, `@anthropic-ai/sdk`): writes the executive summary (structured output)
  and streams Ask PIVOT answers, from `buildAIFacts()` only: the computed analysis plus a list of
  data that *isn't* available. Summaries that mention any number not in the facts are discarded
  (`ungroundedNumbers()`). Uses server-side refusal fallbacks.
- **Built-in engine** (`local.ts`): template summaries and a topic-matching answerer over the same
  analysis. Used without an API key, when a company turns AI narratives off, and as the automatic
  fallback when the AI service fails.

Numbers, scores and insights always come from the engine, never from the model. Summaries are
generated after the response is sent (`after()`) and cached per data version.

### Data Center (CSV)

Upload → validate (CSV only, 10 MB, UTF-8 or Windows-1252, row/column/cell limits) → parse → detect
columns (dates in many formats, money, percentages, header synonyms like "Net Sales" or "Ad spend")
and the file's format (day-first dates, decimal commas in European files) → **review screen** where
every mapping and the format can be changed with a live preview → import → re-analyze.

Two file shapes are understood: period totals (one row per day/week/month, optionally split by one
product, channel or segment column) and order-level files (one row per order with a customer ID).
A total summed from a breakdown file never overrides a real total from another dataset, and your own
data replaces the sample data so the two never mix. A downloadable example lives at `/sample-data.csv`.

### Plans and billing

`src/lib/billing/plans.ts` defines Free, Pro ($99), Business ($499) and Enterprise, and their limits.
New workspaces get a 14-day Pro trial. Limits are enforced on the server
(`src/server/billing/entitlements.ts`). Stripe Checkout, the customer portal and a signature-verified
webhook are implemented but inactive until the Stripe variables are set.

## Security

- **Tenancy:** every query takes the company from a verified membership, never from the browser.
  Integration tests check that one company can't read or change another's data.
- **Auth:** scrypt password hashing; database sessions where only a SHA-256 of the cookie token is
  stored; httpOnly, SameSite=Lax, Secure (in production) cookies; sessions revoked on password
  change and reset; reset and invite tokens stored hashed, single-use and short-lived; login and
  reset don't reveal whether an account exists (reset emails go out after the response); removing
  someone also cancels their pending invitations.
- **Rate limits** on signup, login, password reset, uploads, previews, Ask PIVOT and mutations
  (`src/server/rate-limit.ts`). The store is in-memory: use Redis/Upstash when running more than one
  instance. Client IPs come from the right-hand end of `x-forwarded-for` (the part your own proxies
  added; the rest is client-controlled): set `TRUSTED_PROXY_HOPS` to the number of proxies in front
  of the app (default 1). Login limits count only failed attempts, per email + IP, so knowing
  someone's email isn't enough to lock them out.
- **Input:** Zod on every action and route; uploads validated by type, size and content; user text is
  only ever rendered as text (model output included: `rich-text.tsx` builds React elements, no HTML).
- **Headers:** per-request CSP nonce with `strict-dynamic` (`src/proxy.ts`), HSTS, frame-ancestors none,
  nosniff, strict referrer policy. Same-origin checks on POST route handlers; Next.js checks server
  action origins.
- **Secrets:** API keys are read only in `server-only` modules; nothing but the public app URL is
  exposed to the browser.
- **Errors:** users see friendly messages; details go to server logs.

## Placeholder content

The landing page's customer logos, usage counters ("2,847 decisions simulated this week") and
testimonials are sample content for the launch design. They're all in `src/content/landing.ts`,
marked as placeholders: replace them with real customers, real numbers and permissioned quotes
before going live. Feature result lines on the landing page come from the real engine running on the
demo company.

## Design system

- One typeface (Inter), two weights: 400 and 800. Tailwind's weight scale is reset so only
  `font-normal` and `font-heavy` exist.
- One accent blue (`--pv-accent`), used only for the primary call to action and the single most
  important number on a screen. Green means positive performance; red/orange mean warnings.
- Charts are monochrome (navy emphasis, gray comparison) so the accent stays scarce; one y-axis per
  chart; crosshair tooltips; a screen-reader table for every chart.
- Motion: one orchestrated moment on the landing hero (the compass needle turns, the headline rises);
  in the app, cards fade in, charts draw once, and scores count up (CSS only, honoring reduced motion).
- Mobile first: every page is checked at 390px with no horizontal scrolling.

Tokens live in `src/app/globals.css`; primitives in `src/components/ui/*`.
