# Payvr production build plan

Tracks the production spec ("Tap phones. Money's sent.") against what's in the repo.
Live payment keys are never set by this work; the owner switches to them after the
payments partner approves the account.

## Step 1 · Setup, design system, navigation, all screens (mock data) ✅

- Expo SDK 57, TypeScript, Expo Router, Space Grotesk, dark (default) / light / system with a 200ms fade
- Tabs: Home, Activity, Tap (raised, blue), Wallet, Profile
- Sign-up: phone → SMS code → name, @handle, photo → **identity verification** (legal name,
  date of birth, US address, last 4 of SSN or ID scan) → **link bank or debit card** → Face ID → PIN
- Eligibility block: under 18 or outside the US (`src/config/compliance.ts`)
- Activity with filters (All, Sent, Received, Requests, Pending) and search; Friends feed as a second tab
- Transaction detail with receipt, ID, **Remind** (sent requests, once a day), **Dispute** and **Report a problem**
- Requests: pay with Face ID / PIN, decline, remind
- Wallet: balance, add money, cash out (standard free, instant with fee)
- Settings: edit profile, identity, linked accounts, **limits by tier** ($250 new / $2,000 verified),
  security (Face ID, PIN, trusted devices), notifications, privacy, appearance, help, legal,
  **delete account with data export**
- Support: report a problem, dispute a payment (case numbers)

Mock-mode only for now: KYC (`src/services/kyc.ts`), linking, remind, support and deletion each
throw `*_not_configured` in live mode until their server step lands.

## Step 2 · Supabase schema, migrations, RLS, phone auth
Existing migrations cover users, transactions, contacts, tap sessions, push and Stripe test
top-ups. To add: `kyc_status`, `linked_accounts`, `ledger_entries`, `transfers`, `requests`,
`devices`, `notifications`, `disputes`, `audit_log`, `settings`, RLS on each, and server-side
account deletion and data export.

## Step 3 · Ledger + transfers (sandbox)
Replace the current `balance_cents` column with a **double-entry ledger** (balances derived from
`ledger_entries`), idempotency keys on every transfer, row locks, audit log.

## Step 4 · Payments partner (sandbox)
One server interface at `supabase/functions/payments`: onboarding, KYC, linked accounts,
transfers, signed webhooks as the source of truth (pending → completed / failed / reversed).

## Step 5 · QR, then Bluetooth / UWB tap
QR and BLE tap exist from the prototype (`docs/TAP.md`); harden against the new server.

## Step 6 · Push, limits, fraud, audit
Server-enforced tiered limits (the SQL still caps at $500 until this step), rate limits,
unusual-activity review holds, security alerts, remind push.

## Step 7 · Error states, accessibility, tests, Sentry, PostHog

## Step 8 · Staging builds to TestFlight / Play internal testing
