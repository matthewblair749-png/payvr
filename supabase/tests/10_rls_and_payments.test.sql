-- Tests for Payvr RLS and money functions. Run with scripts/test-db.sh.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

\ir helpers.inc.sql

-- Fixtures: three people sign up -------------------------------------------
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-00000000000a', '14155550001'),
  ('00000000-0000-0000-0000-00000000000b', '14155550002'),
  ('00000000-0000-0000-0000-00000000000c', '14155550003');

set client_min_messages = notice;
select t.ok((select count(*) from public.wallets where balance_cents = 50000) = 3, 'new users get a $500 test wallet');
select t.ok((select count(*) from public.settings where theme = 'dark') = 3, 'new users get default settings');

\set A '''00000000-0000-0000-0000-00000000000a'''
\set B '''00000000-0000-0000-0000-00000000000b'''
\set C '''00000000-0000-0000-0000-00000000000c'''

set role authenticated;

-- Profiles -------------------------------------------------------------------
select t.login(:A);
select t.throws($$select public.send_payment('00000000-0000-0000-0000-00000000000b', 100)$$, 'profile_missing', 'cannot pay before creating a profile');
insert into public.users (id, name, handle) values (:A, 'Matthew Cooper', 'matthew');
select t.ok((select phone from public.users where id = :A) = '14155550001', 'phone comes from auth, not the app');
select t.throws($$insert into public.users (id, name, handle) values ('00000000-0000-0000-0000-00000000000b', 'Imposter', 'imposter')$$,
  'row-level security', 'cannot create a profile for someone else');
select t.throws($$update public.users set phone = '0' where id = '00000000-0000-0000-0000-00000000000a'$$,
  'permission denied', 'cannot change own phone number');
select t.ok(public.handle_available('jake'), 'handle_available: free handle');
select t.ok(public.handle_available('matthew'), 'handle_available: your own handle counts as available');
select t.ok(not public.handle_available('Ab'), 'handle_available: rejects invalid handle');

select t.login(:B);
insert into public.users (id, name, handle) values (:B, 'Jake Rivera', 'jake');
select t.ok(not public.handle_available('matthew'), 'handle_available: taken handle');
select t.throws($$insert into public.users (id, name, handle) values ('00000000-0000-0000-0000-00000000000b', 'x', 'jake2')$$, 'check', 'name must be 2+ characters');

select t.login(:C);
insert into public.users (id, name, handle) values (:C, 'Priya Shah', 'priya');

-- Strangers are invisible until you tap / pay them.
select t.login(:A);
select t.ok((select count(*) from public.users) = 1, 'users: only see yourself before tapping anyone');
select t.ok((select count(*) from public.lookup_handle('jake')) = 1, 'lookup_handle finds a QR handle');
select t.ok((select count(*) from public.wallets) = 1, 'wallets: only see your own');
select t.throws($$update public.wallets set balance_cents = 999999$$, 'permission denied', 'cannot edit your own balance');
select t.throws($$insert into public.transactions (from_user, to_user, amount_cents, type, status) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 100, 'send', 'completed')$$,
  'permission denied', 'cannot insert transactions directly');

-- Sending ----------------------------------------------------------------------
select t.ok(public.add_test_money(10000) = 60000, 'add $100 test money');
select t.ok((public.send_payment(:B, 2000, 'Pizza') ->> 'balance_cents')::bigint = 58000, 'send $20: balance drops to $580');
select t.ok((select count(*) from public.users) = 2, 'after paying Jake, his profile is visible');
select t.ok((select count(*) from public.contacts where contact_user_id = :B) = 1, 'Jake saved as a contact');
select t.throws($$select public.send_payment('00000000-0000-0000-0000-00000000000a', 100)$$, 'invalid_recipient', 'cannot pay yourself');
select t.throws($$select public.send_payment('00000000-0000-0000-0000-00000000000b', 0)$$, 'invalid_amount', 'cannot send $0');
select t.throws($$select public.send_payment('00000000-0000-0000-0000-00000000000b', 48001)$$, 'daily_limit', 'daily limit: $20 + $480.01 is over $500');
select t.ok((public.send_payment(:B, 48000, 'Rent') ->> 'balance_cents')::bigint = 10000, 'can send exactly up to the $500 daily limit');
select t.throws($$select public.send_payment('00000000-0000-0000-0000-00000000000b', 1)$$, 'daily_limit', 'nothing more once the daily limit is used');
select t.login(:C);
select t.throws($$select public.send_payment('00000000-0000-0000-0000-00000000000b', 50001)$$, 'insufficient_funds', 'cannot send more than your balance');
select t.login(:A);

-- Jake sees both payments and his wallet; Priya sees none of it.
select t.login(:B);
select t.ok((select balance_cents from public.wallets) = 100000, 'Jake received $500');
select t.ok((select count(*) from public.transactions) = 2, 'Jake sees the 2 payments to him');
select t.ok((select count(*) from public.contacts where contact_user_id = :A) = 1, 'Matthew saved as Jake''s contact too');
select t.login(:C);
select t.ok((select count(*) from public.transactions) = 0, 'Priya cannot see other people''s transactions');
select t.ok((select count(*) from public.wallets) = 1, 'Priya only sees her own wallet');
select t.ok((select count(*) from public.contacts) = 0, 'Priya cannot see other people''s contacts');

-- Requests ---------------------------------------------------------------------
select t.login(:C);
select public.create_request(:B, 1800, 'Tacos') -> 'transaction' ->> 'id' as req_id \gset
select t.ok((select status from public.transactions where id = :'req_id') = 'pending', 'Priya requests $18 from Jake');
select t.throws($$select public.create_request('00000000-0000-0000-0000-00000000000c', 100)$$, 'invalid_recipient', 'cannot request from yourself');
select t.login(:A);
select t.throws(format('select public.pay_request(%L)', :'req_id'), 'not_found', 'Matthew cannot pay a request aimed at Jake');
select t.throws(format('select public.decline_request(%L)', :'req_id'), 'not_found', 'Matthew cannot decline a request aimed at Jake');
select t.login(:C);
select t.throws(format('select public.pay_request(%L)', :'req_id'), 'not_found', 'the requester cannot pay their own request');
select t.login(:B);
select t.ok((select count(*) from public.users where id = :C) = 1, 'Jake can see who is requesting from him');
select t.ok((public.pay_request(:'req_id') ->> 'balance_cents')::bigint = 98200, 'Jake pays the $18 request');
select t.throws(format('select public.pay_request(%L)', :'req_id'), 'not_pending', 'cannot pay a request twice');
select t.login(:C);
select t.ok((select balance_cents from public.wallets) = 51800, 'Priya received $18');

select public.create_request(:B, 500, 'Coffee') -> 'transaction' ->> 'id' as req2_id \gset
select t.login(:B);
select t.ok((public.decline_request(:'req2_id') -> 'transaction' ->> 'status') = 'declined', 'Jake declines a request');
select t.throws(format('select public.pay_request(%L)', :'req2_id'), 'not_pending', 'cannot pay a declined request');

-- Paid requests count toward the daily limit.
select t.login(:C);
select public.create_request(:B, 48201, 'Big') -> 'transaction' ->> 'id' as req3_id \gset
select t.login(:B);
select t.throws(format('select public.pay_request(%L)', :'req3_id'), 'daily_limit', 'paying a request counts toward the daily limit');

-- Wallet top-up / cash-out (test money) ------------------------------------------
select t.login(:A);
select t.ok(public.add_test_money(10000) = 20000, 'add another $100 test money');
select t.throws($$select public.add_test_money(100001)$$, 'invalid_amount', 'add money is capped at $1,000 at a time');
select t.throws($$select public.cash_out(20001)$$, 'insufficient_funds', 'cannot cash out more than your balance');
select t.ok(public.cash_out(2500) = 17500, 'cash out $25');

-- Tap sessions (build step 5) -----------------------------------------------------
select t.login(:A);
select ble_token as tok_a from public.start_tap_session(2000, 'send') \gset
select t.ok(length(:'tok_a') = 24, 'tap session issues a random token');
select t.login(:C);
select t.throws(format('select * from public.resolve_tap_token(%L)', :'tok_a'), 'no_active_session', 'must be on the Tap screen to discover anyone');
select public.start_tap_session(500, 'request') is not null as started \gset
select t.ok((select name from public.resolve_tap_token(:'tok_a')) = 'Matthew Cooper', 'two phones on the Tap screen find each other');
select t.ok((select count(*) from public.tap_sessions) = 1, 'you only see your own tap session');
reset role;
update public.tap_sessions set expires_at = now() - interval '1 second' where user_id = :A;
set role authenticated;
select t.login(:C);
select t.ok((select count(*) from public.resolve_tap_token(:'tok_a')) = 0, 'expired sessions cannot be discovered');

-- Settings ---------------------------------------------------------------------------
select t.login(:A);
update public.settings set theme = 'light';
select t.ok((select theme from public.settings) = 'light', 'update own settings');
select t.login(:B);
select t.ok((select theme from public.settings) = 'dark', 'other people''s settings are untouched');

-- Avatars storage ---------------------------------------------------------------------
select t.login(:A);
insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000a/me.jpg');
select t.ok(true, 'upload avatar into your own folder');
select t.throws($$insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000b/me.jpg')$$,
  'row-level security', 'cannot upload into someone else''s folder');

-- Anonymous callers ---------------------------------------------------------------------
reset role;
set role anon;
select t.throws($$select public.send_payment('00000000-0000-0000-0000-00000000000b', 100)$$, 'permission denied', 'anon cannot call payment functions');
select t.throws($$select count(*) from public.users$$, 'permission denied', 'anon cannot read users');
reset role;

-- Ledger integrity: total money = starting wallets + top-ups - cash-outs.
select t.ok((select sum(balance_cents) from public.wallets) = 3 * 50000 + 20000 - 2500, 'no money created or lost');
select t.ok((select count(*) from pg_publication_tables where pubname = 'supabase_realtime') = 2, 'transactions and wallets are published to realtime');
\echo 'ALL TESTS PASSED'
