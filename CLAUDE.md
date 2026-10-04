@AGENTS.md

# Payvr

Peer-to-peer payments: tap two phones, money's sent. **Money is sandbox only** (Stripe test
mode). Never switch to live keys; the owner does that manually after partner approval.

## Stack

- App: Expo SDK 57, React Native, TypeScript, Expo Router, Reanimated 4, react-native-svg
- Backend: Supabase (Postgres + RLS, Auth with phone OTP, Realtime, Storage, Edge Functions in Deno)
- Payments: Stripe **test mode** behind one server-side interface
- Native: `modules/payvr-nearby` (BLE advertising + Apple Nearby Interaction)

## Commands

```bash
npm start                 # Expo dev server (mock data when .env has no Supabase keys)
npm run typecheck         # tsc --noEmit
npm run lint              # eslint
npm test                  # unit tests (node --test, src/**/*.test.ts)
npm run test:db           # SQL migrations + RLS/money tests on a throwaway local Postgres
npm run test:functions    # Deno tests for Edge Functions
npm run icons             # re-render logo PNGs from the brand SVG (needs Playwright)
```

Run typecheck, lint and all tests before saying a step is done.

## Layout

```
src/app/            screens (Expo Router)          src/services/   backend/, payments, supabase, storage, tap/, calls/
src/components/     UI kit (PayvrLogo, rows…)       src/store/      app state, authorize (Face ID / PIN)
src/config/         compliance (limits, ages)       src/theme/      colors, typography
supabase/migrations SQL, one file per change        supabase/functions  Edge Functions (+ _shared)
supabase/tests      SQL tests (scripts/test-db.sh)  docs/           feature docs; SECURITY_PLAN.md at root
```

## Security rules (non-negotiable)

1. **Money logic only on the server** (Edge Functions + SQL). The app never computes or writes balances,
   transfers, limits or KYC status.
2. **Double-entry ledger**: every transfer writes entries that sum to zero; balances are derived, never edited.
3. Every transfer needs a valid session, a **confirmation token** (Face ID / PIN, ≤ 60 s, single use)
   and an **idempotency key**. Amounts are integer cents, validated on the server.
4. **RLS on every table, default deny.** Users read only their own rows. Client gets no INSERT/UPDATE/DELETE
   on money, KYC, devices, limits or audit tables. Every new function: revoke `EXECUTE` from `public, anon, authenticated`
   and grant only what's needed. Every new table gets an RLS test proving other users can't read or write it.
5. **Schema changes only as migrations** in `supabase/migrations/`. No dashboard edits.
6. **Secrets never in the app or the repo.** Only `EXPO_PUBLIC_*` values that are public by design
   (Supabase URL + anon key, Stripe publishable key, Sentry DSN). Server keys live in Supabase secrets / EAS env vars.
   Never invent or hard-code keys; ask the owner.
7. Tokens and sessions only in **expo-secure-store**, never AsyncStorage.
8. **Never log** tokens, OTP codes, PINs, full phone numbers, card or bank data.
9. Validate every server input with **zod**. Rate-limit every public endpoint.
10. Stripe stays in **test mode**: the server refuses any non-`sk_test_` key.
11. If something is unsafe or unclear, stop and ask.

## Working agreement

One step of SECURITY_PLAN.md at a time: run tests, show what changed, list what the owner must set up,
commit, then wait for the owner's OK.
