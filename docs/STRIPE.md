# Stripe (test mode)

Payvr only ever uses **Stripe test mode**. Both the app and the server refuse live keys
(`pk_live_…` / `sk_live_…`).

## How money moves

| Action | How |
| --- | --- |
| Send / request / pay a request | Payvr's own ledger in Postgres (`send_payment`, `pay_request`, …). Instant and atomic, with the $500 daily limit. Stripe isn't involved. |
| **Add money** | App → `stripe-topup` creates a Stripe **PaymentIntent** → Stripe's **PaymentSheet** collects the card on the phone → Stripe calls `stripe-webhook` → `stripe_credit_topup` adds the money to the wallet (exactly once, and only the amount Stripe actually charged). |
| **Cash out** | First time: `stripe-connect` creates a **Stripe Connect Express** account and opens Stripe's hosted onboarding. After that: `stripe-cashout` takes the money out of the wallet first, then makes a Stripe **Transfer** to the user's account (with an idempotency key). If Stripe refuses, the money goes back into the wallet. |

- **Cards:** card numbers never reach Payvr. The app talks to Stripe directly, and the
  server only sees PaymentIntent IDs.
- **Server-only access:** the Stripe secret key lives only in the Edge Functions. The
  money functions they call (`stripe_*`) can only be used by the server role; the app
  can't call them.
- **No free money:** once Stripe is switched on, the free test-money shortcuts
  (`add_test_money`, `cash_out`) are turned off.

Why P2P isn't a Stripe charge per payment: Stripe Connect can't move money directly
between two connected accounts. Wallet apps keep their own ledger and use Stripe at the
edges, for money in and money out.

**Before any real money:** a live version of this (stored balances, P2P) needs proper
licensing/compliance (money transmission, KYC) and Stripe's approval for that use case.
This prototype doesn't do any of that.

## Setup

1. **Stripe dashboard (test mode):**
   - Turn on **Connect** (Express accounts).
   - Copy your test **publishable key** (`pk_test_…`) and **secret key** (`sk_test_…`).
2. **Deploy the Edge Functions:**

   ```bash
   npx supabase functions deploy stripe-topup stripe-cashout stripe-connect
   npx supabase functions deploy stripe-webhook stripe-return --no-verify-jwt
   npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_...
   ```

3. **Add a webhook:** in Stripe, point a webhook at
   `https://<ref>.supabase.co/functions/v1/stripe-webhook` for these events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `account.updated`

   Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. **Apply the migrations** (`supabase/migrations`), then switch Stripe mode on in the SQL
   editor:

   ```sql
   update public.app_settings set value = 'test' where key = 'stripe_mode';
   ```

5. **App:** add `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` to `.env`, then rebuild
   the dev build. The Stripe SDK is native, so Expo Go and the web preview can't show the
   card sheet.

## Trying it

- **Add money:** use card `4242 4242 4242 4242`, any future expiry date, any CVC. The
  balance updates when the webhook arrives, usually within a second or two.
- **Cash out:**
  1. Tap **Set up cash out with Stripe** and fill in Stripe's test onboarding form (Stripe
     pre-fills test values).
  2. For the bank, use the routing number `110000000` with account number `000123456789`.
  3. Then cash out.
- **Test-mode caveat:** transfers need *available* balance in your platform's Stripe
  account. Money from top-ups starts out as *pending*. To get available funds immediately,
  add money with the test card `4000 0000 0000 0077` (it skips the pending period).
  Otherwise, a cash-out fails cleanly and the money stays in the wallet.

## Tests

```bash
npm run test:db                      # SQL: top-ups, cash-outs, refunds, permissions, Stripe mode
deno test -A supabase/functions      # Edge Function logic with fake Stripe/DB + real signature checks
```
