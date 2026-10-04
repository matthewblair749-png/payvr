# Payvr security plan

Goal: real accounts, real logins, production-grade security. **Money stays in sandbox
(Stripe test mode) until the owner says otherwise.** Each step ends with tests passing,
a commit, and the owner's OK before the next step starts.

Status key: `[ ]` to do · `[x]` done · `[~]` partly done today · `(you)` needs the owner.

---

## Part A · What exists today (step 0 findings)

### Structure

```
src/app/            Expo Router screens (auth flow, tabs, tap, qr, wallet, chat, settings, support)
src/services/       backend/ (live = Supabase, mock = in-memory), payments.ts, supabase.ts,
                    storage.ts (SecureStore; localStorage on web), biometrics.ts, tap/, calls/, push.ts
src/store/          app-store (session + data), authorize.tsx (Face ID or PIN before payments),
                    account.ts (KYC/linked status, mock only), social/chat/cards/call stores
supabase/migrations 5 migrations: users, wallets, transactions, contacts, tap_sessions, settings,
                    stripe_* tables, push_tokens, notification_outbox, app_settings
supabase/functions  stripe-topup, -cashout, -connect, -return, -webhook, push-send, _shared/
supabase/tests      SQL tests (RLS, payments, tap, Stripe, push, concurrency) via scripts/test-db.sh
modules/payvr-nearby  native BLE advertising + Nearby Interaction
```

### What works

- Phone + SMS sign-in through Supabase Auth (`signInWithOtp` / `verifyOtp`) when `.env` has keys.
- Supabase session stored in expo-secure-store (Keychain / Keystore), chunked; auto-refresh.
- RLS enabled on every table; the app has SELECT plus a few column-level UPDATEs only.
- Money moves in `SECURITY DEFINER` SQL functions that lock both wallets in a fixed order
  (a 10-way concurrency test passes), check the balance and a $500 rolling 24h limit.
- Stripe **test mode only**: the server refuses non-`sk_test_` keys; the webhook verifies signatures;
  top-ups are credited exactly once per PaymentIntent; cash-outs refund on failure.
- Tap sessions: random 96-bit token, 60-second expiry, only resolvable while both phones have a session open.
- Tests passing today: 34 unit tests (`npm test`), all SQL tests (`npm run test:db`).

### What is mocked or prototype-only

- With no `.env`, the whole app runs on in-memory mock data (`services/backend/mock.ts`).
- KYC, bank/card linking, remind, support tickets, disputes, account deletion: mock only
  (they refuse to run in live mode).
- Chat is local only (no tables). Calls use Supabase broadcast for signaling.
- `add_test_money` / `cash_out` RPCs and the seed's `demo_incoming_*` functions create money from nothing.

### Security problems found

Severity: **C** critical · **H** high · **M** medium · **L** low.

| # | Sev | Problem | Where |
|---|-----|---------|-------|
| 1 | C | The app calls money RPCs (`send_payment`, `pay_request`, `cash_out`…) directly. No server-side proof of Face ID/PIN, no idempotency key, so a stolen session token can move money and a retry can double-send. | migrations init / push_and_refs, `services/payments.ts` |
| 2 | C | The PIN is 4 digits, stored in plain text on the phone (and `localStorage` on web), checked only on the phone, defaults to `1234`, has no lockout. | `store/authorize.tsx`, `services/storage.ts` |
| 3 | C | `add_test_money` mints money for any signed-in user while `stripe_mode = 'off'` (the default). New users also get $500 from nowhere. `demo_incoming_payment` in `seed.sql` mints money too and is granted to every user if the seed is ever applied to a real project. | stripe migration, init trigger, `seed.sql` |
| 4 | H | Balances are a mutable column (`wallets.balance_cents`), not a double-entry ledger; there's no way to prove the books balance. | init migration |
| 5 | H | Call signaling uses public Realtime broadcast channels named `calls:<user id>`: anyone with the app's public key can listen to someone's call offers (SDP/ICE, which leak IPs) or send fake calls. | `services/calls/signaling.ts` |
| 6 | H | `push-send` Edge Function has no caller check; anyone holding any valid JWT (including the public anon key) can trigger it. | `functions/push-send` |
| 7 | H | No rate limits anywhere: SMS codes, handle lookups (`lookup_handle` lets anyone enumerate handles), requests (`create_request` can spam anyone), transfers. | migrations, Auth config |
| 8 | H | No app lock on return from background; anyone holding an unlocked phone has the app. | app |
| 9 | H | No new-device check or notification; no devices list; no "sign out everywhere". | app + server |
| 10 | H | No Auth configuration in code (OTP expiry, JWT expiry, SMS rate limits, captcha, country allowlist). It lives only in the dashboard, if set at all. No `supabase/config.toml`. | missing |
| 11 | M | Tap tokens can be resolved repeatedly within the 60 seconds and aren't bound to the pair of users who tapped; the token→profile lookup is a small enumeration surface. | tap migration |
| 12 | M | Phone number copied in plain text into `public.users.phone`. KYC data (legal name, DOB) isn't stored yet, but there's no plan for protecting it. | init migration |
| 13 | M | Handles allow `.`; no reserved/offensive word list; uniqueness is case-insensitive only because the app lowercases. | init migration |
| 14 | M | Two `send_payment` overloads exist (3 and 4 args), both executable by users. Supabase's default `EXECUTE` grant on new functions means each migration must remember to revoke. | migrations |
| 15 | M | Avatars bucket is public (anyone with a URL can view any photo; paths contain the user ID). | init migration |
| 16 | M | Edge Functions: CORS `*`, inputs validated by hand (no zod), errors sometimes echo internal messages. | `functions/_shared/http.ts` |
| 17 | M | No audit log for logins, devices, PIN changes, limits, transfers. | missing |
| 18 | M | No crash reporting; no log scrubbing policy; no secret scanning in CI; no CI at all. | missing |
| 19 | M | `npm audit`: 32 issues (21 high, 11 moderate), mostly in build-time tooling. | `package-lock.json` |
| 20 | L | Web build keeps the session in `localStorage` (web is a preview only today). | `services/storage.ts` |
| 21 | L | Daily limit is hard-coded at $500 in SQL; the app shows tiered limits ($250 / $2,000) from a mock store. | init migration, `store/account.ts` |

No secrets are committed (checked for live/test Stripe keys, JWTs, webhook secrets and AWS keys).

### Limits of this environment (honest)

- No Docker daemon, so the full Supabase local stack (Auth, Edge runtime) can't run here.
  SQL migrations and RLS are tested against a real local Postgres with Supabase stand-ins (`npm run test:db`).
- `deno.land` is blocked here; I'll try installing Deno from npm for Edge Function tests. If that fails,
  function tests are written and run in CI (GitHub Actions) instead.
- Maestro needs an iOS simulator or Android emulator: I'll write the flows; they run on your machine or in EAS Workflows.

---

## Part B · Decisions I need from you before Step 1

1. **KYC data:** I recommend **not storing** legal name, DOB or address at all. The KYC partner keeps them,
   and we store only the partner's reference and status. Less data means less to leak. If you'd rather keep a copy,
   I'll encrypt those columns with keys held in Supabase Vault. *Which do you want?*
2. **Existing sandbox balances:** moving to a double-entry ledger means migrating today's test balances
   to opening entries, or **resetting** all sandbox balances to $0. *Reset or migrate?*
3. **Mock mode:** keep the no-backend demo mode for previews and development only, and make production and staging builds
   refuse to start without Supabase? (Recommended.)
4. **Email backup login:** email one-time code (no passwords, recommended), or email + password?
   With no passwords, "leaked password protection" doesn't apply; I'll still turn it on.
5. **Location in "New login on iPhone 15 in Ohio":** needs an IP→city lookup service.
   OK to use one (e.g. a free IP geolocation API, city-level only), or show the device name only?

---

## Part C · Checklist

### Step 0 · Understand
- [x] Read the project; findings above
- [x] SECURITY_PLAN.md (this file)
- [x] CLAUDE.md: stack, commands, layout, security rules

### Step 1 · Real accounts & login
- [ ] `supabase/config.toml` committed with Auth settings: phone auth via **Twilio Verify**, OTP expiry 5 min,
      JWT expiry 15 min with refresh-token rotation and reuse detection, captcha (Turnstile) on, email OTP as backup
- [ ] Send-SMS Auth Hook: US-only country allowlist, per-phone (5/h) and per-IP (20/day) limits, block SMS pumping patterns
- [ ] Profile: name, @handle 3–20 chars `[a-z0-9_]`, case-insensitive unique index, reserved + offensive word list (server-side), photo
- [ ] Remove the `.` from handles (migrate existing handles)
- [ ] Sessions only in expo-secure-store (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); web preview uses memory only
- [ ] App lock: Face ID / fingerprint after 5 min in background; **6-digit PIN** fallback
- [ ] PIN stored only as a salted hash on the server (bcrypt via pgcrypto); verified by an Edge Function; lockout 15 min after 5 wrong tries
- [ ] Devices: `devices` table (device ID, name, platform, first/last seen, session ID); register on login
- [ ] New device = SMS code required + push to other devices ("New login on … — was this you?") + "That wasn't me" → sign out everywhere
- [ ] Settings → Devices: list sessions, sign out any (server deletes the auth session)
- [ ] Sign out everywhere on PIN change or account recovery
- [ ] Account recovery: new phone → SMS + identity re-check with the KYC partner; no support override path
- [ ] Delete account: server-side export (JSON of everything we hold) + deletion (profile, devices, tokens; ledger kept as legally required, de-identified)

### Step 2 · Database security
- [ ] RLS on every table, **default deny**; policies only for own rows; a test that fails if any table lacks RLS
- [ ] Migration that revokes Supabase's default `EXECUTE` on new functions (`alter default privileges`), so nothing is callable unless granted
- [ ] Money, KYC status, devices, limits, audit tables: **no** client write grants; written only by Edge Functions (service role)
- [ ] Drop the client-callable money RPCs and the 3-arg `send_payment` overload
- [ ] Sensitive columns: drop `public.users.phone` (read from auth when needed); KYC per decision B1
- [ ] Avatars: private bucket with signed URLs (or keep public with random file names; decide in step)
- [ ] Private Realtime channels with Realtime Authorization for calls and data
- [ ] RLS test **for every table**: user B tries to select/insert/update/delete user A's rows → must fail

### Step 3 · Money safety (sandbox)
- [ ] Double-entry ledger: `ledger_accounts` (user wallets + system accounts), `transfers`, `ledger_entries`;
      a constraint trigger ensures every transfer's entries sum to zero; balance = sum of entries
- [ ] `transfers` Edge Function: valid session + **confirmation token** + idempotency key → one SQL transaction with row locks
- [ ] Confirmation token: Face ID path = device secret in SecureStore that only unlocks with biometrics, used to sign a server challenge;
      PIN path = server PIN check. Either issues a single-use 60-second token bound to user, device, amount and recipient
- [ ] Server validation: integer cents, positive, within limits, sender ≠ receiver, sender verified, sufficient balance
- [ ] Idempotency: unique `(user, idempotency_key)`; a repeat returns the original result
- [ ] `_shared/payments.ts`: one provider interface (Stripe test mode today), test keys enforced
- [ ] Webhooks: signature verified, events de-duplicated, status `pending → completed / failed / reversed` driven only by webhooks
- [ ] Remove free test money (`add_test_money`, $500 sign-up gift); sandbox top-ups go through Stripe test cards

### Step 4 · Attack protection
- [ ] Rate limits table + helper used by every Edge Function (transfers, PIN tries, handle search, requests, OTP)
- [ ] PIN lockout (5 wrong → 15 min), counted server-side
- [ ] US-only + Turnstile on web sign-up
- [ ] Limits: $250/day new, $2,000/day verified, enforced in SQL (config table, not hard-coded)
- [ ] Risk rules: new device (< 24 h) + large transfer, or ≥ N new recipients in an hour → status `held`, reviewed in an admin queue
- [ ] Tap tokens: single-use, 60 s, bound to both user IDs once matched, replay rejected
- [ ] zod schemas for every Edge Function input
- [ ] `scripts/check-secrets.mjs` in CI and as an EAS pre-build hook; fails on secret-looking strings
- [ ] No secrets in the bundle: only `EXPO_PUBLIC_SUPABASE_URL` / anon key / Stripe publishable key / Sentry DSN (all public by design)

### Step 5 · Privacy & logging
- [ ] `audit_log`: login, new device, PIN change/lockout, transfer, limit change, device sign-out, recovery, deletion (actor, device, IP, user agent)
- [ ] Log hygiene: helper that masks phone numbers, never logs tokens, codes or card data; lint rule against `console.log` in app code
- [ ] Sentry (app + Edge Functions) with `sendDefaultPii: false` and a `beforeSend` scrubber
- [ ] PRIVACY.md: every data item, why, where it's stored, retention (for App Store / Play labels)

### Step 6 · Testing
- [ ] Deno unit tests for every Edge Function
- [ ] RLS tests for every table (from step 2)
- [ ] Idempotency (double submit), race (two transfers at once), expired/replayed confirmation token, PIN lockout, limits
- [ ] Maestro flows: sign up → verify → send → receive → log out → log in on a new device
- [ ] GitHub Actions: lint, typecheck, unit, SQL, Deno, secret scan on every push

### Step 7 · Review & launch
- [ ] SECURITY_REVIEW.md against OWASP Mobile Top 10 (2024) and OWASP API Security Top 10 (2023)
- [ ] `npm audit`: fix high/critical (or document why a build-only advisory is not reachable)
- [ ] dev / staging / production Supabase projects; `eas.json` profiles with EAS environment variables
- [ ] Certificate pinning (or a documented decision), jailbreak/root warning
- [ ] LAUNCH_CHECKLIST.md: everything only you can do

### What you'll need to set up (asked for at the step that needs it)

| When | What |
|------|------|
| Step 1 | Supabase projects (dev, later staging/prod) · Twilio account + Verify Service · Cloudflare Turnstile site key |
| Step 3 | Stripe **test** secret key + webhook secret (set as Supabase secrets, never sent to me in chat) |
| Step 5 | Sentry project DSN |
| Step 7 | Apple Developer + Google Play accounts, EAS project, payments partner approval, legal review, pen test |
