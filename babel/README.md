# babel

**Everyone speaks your language.** Paste some text and read it in your own language, or open a room and chat
with someone who speaks another one, each of you writing and reading your own.

> Status: **Phase 1 of 4: landing page and live demo.** Accounts and payments (Phase 2), shared rooms
> (Phase 3) and the browser extension (Phase 4) are not built yet.

This app lives in `babel/` inside the `payvr` repo. It is a standalone Next.js app with its own
`package.json`; run every command below from this folder.

## Quick start

```bash
cd babel
npm install
cp .env.example .env.local   # optional: works with no keys at all
npm run dev                  # http://localhost:3000
```

With no keys, the demo runs on the built-in **preview phrasebook**: three hand-checked sentences in ten
languages, all labelled "Preview" in the UI. Anything else gets a friendly "preview only knows a few
sentences" message. Add a DeepL or Anthropic key to translate anything.

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |

Requires Node 20+.

## Environment variables

Secrets go in `.env.local` (git-ignored). Never commit keys.

| Var | Required | Notes |
| --- | --- | --- |
| `TRANSLATION_PROVIDER` | no | `preview` (default), `deepl` or `anthropic` |
| `DEEPL_API_KEY` | if `deepl` | Free-tier keys end in `:fx` and use the free endpoint automatically |
| `ANTHROPIC_API_KEY` | if `anthropic` | |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-opus-5-5` |

Phase 2 adds `DATABASE_URL`, auth and Stripe variables, and the steps for running Stripe webhooks locally.

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
- **Cache** (`server/cache.ts`): results are keyed by a SHA-256 of provider, languages, tone and text, so
  the same text is never translated twice and the key never contains the text itself. Phase 1 uses an
  in-memory LRU per server instance; Phase 2 adds a Postgres `TranslationCache` behind the same interface.
  Callers pass `noCache: true` for private text (room messages) so it never gets stored.
- **Demo API** (`POST /api/translate`): validates input with Zod (max 1,000 characters), rate-limits to
  20 requests per 5 minutes per IP (in memory, per instance), and never logs the text people send.

## Project layout

```
src/
  app/                    routes: /, /pricing, /privacy, /api/translate
  config/
    plans.ts              every plan, price and limit, in one place
    site.ts               site constants, where "Try it free" points
  components/ui/          Button, PreviewBadge
  features/
    brand/                Logo, Mascot (inline SVG, eyes follow the cursor)
    landing/              landing page sections and demos
    pricing/              plan cards, billing toggle, FAQ
    translation/          languages, phrasebook, translate() and providers
tests/                    Vitest: translation cache, preview provider, rate limit and validation
```

## Design notes

- Colors, spacing (8px grid), radii and motion timings are CSS variables in `src/app/globals.css`.
  `.on-dark` flips text and focus colors for ink sections.
- Fonts (Nunito, Manrope) are self-hosted through Fontsource: no requests to Google at runtime.
- Every looping animation (mascot wave, blink, head tilt, chat playback, status pill) turns off under
  `prefers-reduced-motion`.
- Coral (`#FF5A3C`) is too light for white text, so primary buttons use ink text on coral (4.8:1), and
  coral-coloured text uses the darker `--coral-text`.
