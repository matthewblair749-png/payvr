# babel

**Everyone speaks your language.** Paste some text and read it in your own language, or open a room and chat
with someone who speaks another one, each of you writing and reading your own.

> Status: **Phase 2 of 4: accounts and payments.** Landing page and live demo (Phase 1), sign-up and
> sign-in, the dashboard, Stripe subscriptions and server-side plan limits (Phase 2). Shared rooms
> (Phase 3) and the browser extension (Phase 4) are not built yet.

This app lives in `babel/` inside the `payvr` repo. It is a standalone Next.js app with its own
`package.json`; run every command below from this folder.

## Quick start

Requires Node 20+ and Postgres 14+.

```bash
cd babel
npm install                         # also generates the Prisma client
cp .env.example .env.local          # then fill in AUTH_SECRET (openssl rand -base64 32)
cp .env.local .env                  # the Prisma CLI reads .env
createdb babel && createdb babel_test   # or point DATABASE_URL at any Postgres
npm run db:migrate                  # create tables
npm run dev                         # http://localhost:3000
```

**Signing in locally:** with `EMAIL_SERVER` empty, the magic link is printed in the server console and
shown on the "Check your inbox" page. That shortcut only exists in development; production always
needs `EMAIL_SERVER`.

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests; database tests are skipped |
| `npm run test:db` | All tests, including against `TEST_DATABASE_URL` |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm run db:migrate` / `db:deploy` | Create a migration in dev / apply migrations in production |
| `npm run stripe:listen` | Forward Stripe test webhooks to your local server |

## Environment variables

Secrets live in `.env.local` (and `.env` for the Prisma CLI). Both are git-ignored. Never commit keys.

| Var | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `TEST_DATABASE_URL` | for `test:db` | A separate database. Tests only add rows |
| `APP_URL` | production | Public URL, used for Stripe return URLs and the same-origin check |
| `AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | no | Google sign-in. The button only appears when both are set |
| `EMAIL_SERVER` | production | SMTP URL for magic links |
| `EMAIL_FROM` | no | Sender, e.g. `babel <hello@yourdomain>` |
| `STRIPE_SECRET_KEY` | for upgrades | Test key (`sk_test_…`) until launch |
| `STRIPE_WEBHOOK_SECRET` | for upgrades | Signing secret of your webhook endpoint |
| `TRANSLATION_PROVIDER` | no | `preview` (default), `deepl` or `anthropic` |
| `DEEPL_API_KEY` | if `deepl` | Free-tier keys end in `:fx` and use the free endpoint automatically |
| `ANTHROPIC_API_KEY` | if `anthropic` | |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-opus-5-5` |

## Plans and limits

Every plan, price shown, limit and the grace period live in **`src/config/plans.ts`**. Change a number
there and the pricing page, dashboard and enforcement all follow.

Limits are enforced on the server (`src/features/usage/server.ts`). Each counted action takes a
per-user Postgres advisory lock, counts `UsageEvent` rows in the current window and records the new
one in one transaction, so parallel requests can't sneak past a limit. Daily limits reset at
midnight UTC, monthly ones on the 1st (UTC). If a translation fails, its use is given back.

## Stripe setup

Babel finds each Stripe Price by its **lookup key**, so no price IDs go in env vars.

1. In the Stripe dashboard (test mode), create a product per paid plan, each with a monthly and a
   yearly recurring price. Give each price one of these lookup keys:

   | Plan | Monthly | Annual |
   | --- | --- | --- |
   | Plus | `babel_plus_monthly` | `babel_plus_annual` |
   | Pro | `babel_pro_monthly` | `babel_pro_annual` |
   | Teams (per seat) | `babel_teams_monthly` | `babel_teams_annual` |

   To change a price later, create a new Price and move the lookup key to it.
2. Turn on the **Customer Portal** (Settings → Billing → Customer portal): allow updating payment
   methods, cancelling, and switching between the plans above.
3. Add a webhook endpoint at `<APP_URL>/api/stripe/webhook` for these events:
   `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.

### Running webhooks locally

```bash
stripe login                       # once, with the Stripe CLI
npm run stripe:listen              # prints a whsec_… secret
# put that secret in STRIPE_WEBHOOK_SECRET in .env.local, restart `npm run dev`
stripe trigger checkout.session.completed   # or upgrade through /pricing with card 4242 4242 4242 4242
```

### How billing behaves

- **Upgrading:** `/pricing` posts to `/api/billing/checkout`, which sends you to Stripe Checkout.
  People who already pay are sent to the Customer Portal instead, so nobody ends up with two
  subscriptions.
- **Managing or cancelling:** "Manage billing" opens the Customer Portal. A cancelled plan keeps
  working until the end of the paid period.
- **Webhooks** are verified against the raw body and idempotent: each event id is recorded in the
  same transaction as its changes, and older events can't overwrite newer state.
- **Failed payments:** the plan keeps working for `PAYMENT_GRACE_PERIOD_DAYS` (7) while Stripe retries,
  with a banner on the dashboard. After that the account uses Free limits until the payment goes
  through. Nothing is deleted.

## How translation works

Everything goes through one function:

```ts
translate(text, from, to, options) // src/features/translation/server/translate.ts
```

- **Providers** (`server/providers/`) implement one `TranslationProvider` interface. Switching engines is
  an env change; nothing else in the app knows which one is running.
  - `deepl`: DeepL API.
  - `anthropic`: Claude, with structured JSON output, low effort (translation is a light task), and
    server-side refusal fallback turned on, so a false-positive safety decline is retried on another
    model instead of failing.
  - `preview`: the hand-checked phrasebook in `src/features/translation/phrasebook.ts`.
- **Cache** (`server/cache.ts`, `server/prisma-cache.ts`): results are stored in the `TranslationCache`
  table, keyed by a SHA-256 of provider, languages, tone and text, so the same text is never translated
  twice and the source text is never stored. Without `DATABASE_URL` it falls back to an in-memory cache.
  Callers pass `noCache: true` for private text (room messages) so it never gets stored.
- **API** (`POST /api/translate`): validates input with Zod (max 1,000 characters). Signed-in users are
  held to their plan's daily limit; anonymous visitors to 20 requests per 5 minutes per IP. The text
  people send is never logged.

## Project layout

```
src/
  app/                    routes and API endpoints
  config/
    plans.ts              every plan, price and limit, in one place
    site.ts               site constants
  components/ui/          Button, PreviewBadge
  features/
    auth/                 Auth.js setup, sign-in/up pages, magic-link email
    billing/              entitlements, Checkout/Portal, Stripe webhooks
    brand/                Logo, Mascot (inline SVG, eyes follow the cursor)
    dashboard/            the signed-in dashboard
    landing/              landing page sections and demos
    pricing/              plan cards, billing toggle, FAQ
    translation/          languages, phrasebook, translate(), providers, caches
    usage/                server-side plan-limit enforcement
  server/db.ts            Prisma client
prisma/                   schema and migrations
tests/                    Vitest: plan limits, webhooks, translation cache, entitlements, and more
```

## Design notes

- Colors, spacing (8px grid), radii and motion timings are CSS variables in `src/app/globals.css`.
  `.on-dark` flips text and focus colors for ink sections.
- Fonts (Nunito, Manrope) are self-hosted through Fontsource: no requests to Google at runtime.
- Every looping animation (mascot wave, blink, head tilt, chat playback, status pill) turns off under
  `prefers-reduced-motion`.
- Coral (`#FF5A3C`) is too light for white text, so primary buttons use ink text on coral (4.8:1), and
  coral-coloured text uses the darker `--coral-text`.
