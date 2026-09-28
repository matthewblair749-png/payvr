# Connecting Payvr to Supabase

Without Supabase keys the app runs on built-in mock data. With them, the app uses
Supabase for sign-in, data, realtime and photos. **Test money only.**

## 1. Create the project

1. Create a project at [supabase.com](https://supabase.com).
2. **Apply the schema.** Either:
   - **Dashboard:** SQL Editor → run each file in `supabase/migrations/` **in filename order**.
   - **CLI:** `npx supabase init` (keep the existing `supabase/` folder),
     `npx supabase link --project-ref <ref>`, then `npx supabase db push`.
3. **Optional, dev projects only:** run `supabase/seed.sql` in the SQL Editor. It adds
   demo people (Jake, Priya, Sofia). This lets one phone try tapping and QR, and makes the
   Profile → Prototype buttons work against the real backend.

## 2. Turn on phone sign-in

Authentication → Sign In / Providers → **Phone**:

- Enable it and choose an SMS provider (for example Twilio).
- While testing, add **test phone numbers** with fixed codes (for example
  `+14155550142` → `123456`). No SMS is sent for these numbers.

Exact menu names can shift between Supabase dashboard versions.

## 3. Add the keys to the app

```bash
cp .env.example .env
# EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
npx expo start -c
```

The anon/publishable key is designed to ship inside apps. Row-level security is what
protects the data. **Never** put the `service_role` / secret key in the app.

## What's in the database

| Table | What it holds | Who can read it | Who can write it |
| --- | --- | --- | --- |
| `users` | name, @handle, phone, photo | you, plus people you've tapped or paid | you (name, handle, photo only; phone comes from Auth) |
| `wallets` | balance (starts at $500 test) | you | only the money functions |
| `transactions` | payments and requests | the two people involved | only the money functions |
| `contacts` | people you've tapped or paid | you | money functions; you can delete |
| `tap_sessions` | 60-second BLE token (step 5) | you | `start_tap_session` |
| `settings` | theme, notifications | you | you |

**Money functions** (Postgres `SECURITY DEFINER`, called with `supabase.rpc`):
`send_payment`, `create_request`, `pay_request`, `decline_request`, `add_test_money`,
`cash_out`. Each one:

- locks both wallets
- checks the balance and the **$500 rolling-24-hour send limit**
- writes the transaction, updates both balances and saves both people as contacts, all
  in one database transaction

The app has no permission to change balances or transactions directly.

**Other functions:**
- `lookup_handle`: QR scans. Returns only name, @handle and photo.
- `handle_available`: checks a handle during sign-up.
- `start_tap_session` / `resolve_tap_token` / `end_tap_session`: for Bluetooth in step 5.
  A token only resolves while both phones have an open session, and sessions expire
  after 60 seconds.

**Realtime:** `transactions` and `wallets` are published. Realtime applies row-level
security, so each phone only receives its own rows. That is how the other phone shows
"Jake paid you $20 · Pizza" the moment a payment lands.

**Photos:** public `avatars` bucket. You can only upload to `avatars/<your user id>/…`.

## Tests

```bash
npm run test:db
```

This spins up a throwaway local Postgres 15+ with stand-ins for Supabase's `auth` and
`storage` schemas (including Supabase's default grants), applies the migrations, and runs
`supabase/tests`: 135 checks covering RLS, payments, requests, limits, tap sessions,
Stripe, push notifications, storage and the seed helpers. It also runs a double-spend
test: 10 simultaneous $100 sends from a $500 wallet, where exactly 5 must succeed.

The tests don't cover Supabase-hosted pieces (the Auth/SMS service, the Realtime server,
the Storage API). Those need a real project; see the checklist below.

## First run on a real project: checklist

- [ ] Sign up with a test number → profile saved, wallet shows $500.
- [ ] Second phone (or a second test number on another device) signs up.
- [ ] Phone A: QR → My code. Phone B: QR → Scan → pay $5.
- [ ] Phone A: Request $12 → Tap → "Show QR code instead". Phone B scans it → "Pay $12 to …?"
      → pays. Phone A jumps to "… paid you $12".
- [ ] Scan phone A's request code with phone B's **system camera app** → opens Payvr on Confirm.
- [ ] Wait 3+ minutes and scan a screenshot of an old request code → "That code has expired".
- [ ] Phone A shows the "paid you" banner instantly and the balance counts up.
- [ ] Phone B requests from A; A sees the request banner; A pays with PIN / Face ID.
- [ ] Try to send more than $500 in a day → friendly daily-limit message.
