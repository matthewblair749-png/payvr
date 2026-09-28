-- Stripe test mode (step 6): top-ups, cash-outs, and the switch that retires test money.
\set ON_ERROR_STOP 1
\ir helpers.inc.sql
set client_min_messages = notice;

\set U '''00000000-0000-0000-0000-0000000000e1'''
\set V '''00000000-0000-0000-0000-0000000000e2'''
insert into auth.users (id, phone) values (:U, '1'), (:V, '2');
set role authenticated;
select t.login(:U);
insert into public.users (id, name, handle) values (:U, 'Una Stripe', 'una');
select t.login(:V);
insert into public.users (id, name, handle) values (:V, 'Vic Stripe', 'vic');
reset role;

-- The app can't touch any of the Stripe functions or rows directly.
set role authenticated;
select t.login(:U);
select t.throws($$select public.stripe_credit_topup('pi_x', 100)$$, 'permission denied', 'app cannot credit a top-up');
select t.throws($$select public.stripe_begin_cashout('00000000-0000-0000-0000-0000000000e1', 100)$$, 'permission denied', 'app cannot start a cash-out directly');
select t.throws($$insert into public.wallet_topups (user_id, amount_cents, payment_intent_id) values ('00000000-0000-0000-0000-0000000000e1', 100, 'pi_fake')$$, 'permission denied', 'app cannot insert top-ups');
select t.throws($$update public.app_settings set value = 'off'$$, 'permission denied', 'app cannot flip Stripe mode');
reset role;

-- Turning Stripe on retires the free test-money shortcuts.
update public.app_settings set value = 'test' where key = 'stripe_mode';
set role authenticated;
select t.login(:U);
select t.throws($$select public.add_test_money(1000)$$, 'stripe_required', 'add_test_money is disabled once Stripe is on');
select t.throws($$select public.cash_out(1000)$$, 'stripe_required', 'cash_out shortcut is disabled once Stripe is on');
reset role;

-- Add money: PaymentIntent recorded, then the webhook credits it exactly once.
set role service_role;
select public.stripe_record_topup(:U, 2500, 'pi_123') is not null as recorded \gset
select t.ok(public.stripe_record_topup(:U, 2500, 'pi_123') is not null, 'recording the same PaymentIntent twice is harmless');
select t.ok(public.stripe_credit_topup('pi_123', 2500) = 52500, 'webhook credits $25');
select t.ok(public.stripe_credit_topup('pi_123', 2500) = 52500, 'a repeated webhook does not credit twice');
select t.throws($$select public.stripe_credit_topup('pi_nope', 100)$$, 'unknown_payment_intent', 'unknown PaymentIntents are rejected');
select public.stripe_record_topup(:U, 1000, 'pi_456') is not null as r2 \gset
select t.throws($$select public.stripe_credit_topup('pi_456', 999999)$$, 'amount_mismatch', 'credit must match what was recorded');
select public.stripe_fail_topup('pi_456');
select t.ok((select status from public.wallet_topups where payment_intent_id = 'pi_456') = 'failed', 'failed payments are marked failed');
select t.throws($$select public.stripe_record_topup('00000000-0000-0000-0000-0000000000e1', 100001, 'pi_big')$$, 'check', 'top-ups are capped at $1,000');
reset role;

set role authenticated;
select t.login(:U);
select t.ok((select count(*) from public.wallet_topups) = 2, 'you can see your own top-ups');
select t.login(:V);
select t.ok((select count(*) from public.wallet_topups) = 0, 'but not other people''s');
reset role;

-- Cash out: needs a Connect account with payouts enabled.
set role service_role;
select t.throws($$select public.stripe_begin_cashout('00000000-0000-0000-0000-0000000000e1', 1000)$$, 'payouts_not_ready', 'no cash-out before Stripe onboarding');
select public.stripe_save_account(:U, 'cus_U', 'acct_U', false);
select t.throws($$select public.stripe_begin_cashout('00000000-0000-0000-0000-0000000000e1', 1000)$$, 'payouts_not_ready', 'no cash-out while onboarding is incomplete');
select public.stripe_set_payouts_enabled('acct_U', true);
select t.ok((select customer_id from public.stripe_accounts where user_id = :U) = 'cus_U', 'save_account keeps the customer id');
select public.stripe_save_account(:U, null, null, null);
select t.ok((select payouts_enabled and customer_id = 'cus_U' from public.stripe_accounts where user_id = :U), 'partial updates keep existing values');

select public.stripe_begin_cashout(:U, 2000) as c1 \gset
select t.ok((select balance_cents from public.wallets where user_id = :U) = 50500, 'cash-out takes the money out of the wallet first');
select t.ok(public.stripe_complete_cashout(:'c1', 'tr_1') = 50500, 'transfer succeeded → cash-out paid');
select t.throws(format('select public.stripe_complete_cashout(%L, %L)', :'c1', 'tr_again'), 'not_pending', 'a cash-out completes only once');

select public.stripe_begin_cashout(:U, 3000) as c2 \gset
select t.ok(public.stripe_fail_cashout(:'c2', 'Stripe said no') = 50500, 'transfer failed → money goes back');
select t.throws(format('select public.stripe_fail_cashout(%L, %L)', :'c2', 'again'), 'not_pending', 'a failed cash-out is refunded only once');
select t.throws($$select public.stripe_begin_cashout('00000000-0000-0000-0000-0000000000e1', 999999)$$, 'insufficient_funds', 'cannot cash out more than the balance');
reset role;

-- The Edge Functions' role can read accounts even without project default grants.
set role service_role;
select t.ok((select count(*) from public.stripe_accounts) = 1, 'service role can read Stripe accounts');
reset role;

-- Ledger: $500 + $25 top-up − $20 cash-out for Una; Vic untouched.
select t.ok((select sum(balance_cents) from public.wallets) = 100000 + 2500 - 2000, 'money in = money out');
\echo 'STRIPE TESTS PASSED'
