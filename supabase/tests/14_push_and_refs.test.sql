-- Push notifications (outbox) and QR payment refs (step 7).
\set ON_ERROR_STOP 1
\ir helpers.inc.sql
set client_min_messages = notice;

\set M '''00000000-0000-0000-0000-00000000aa01'''
\set J '''00000000-0000-0000-0000-00000000aa02'''
insert into auth.users (id, phone) values (:M, '1'), (:J, '2');
set role authenticated;
select t.login(:M);
insert into public.users (id, name, handle) values (:M, 'Matthew Cooper', 'matthew');
select t.login(:J);
insert into public.users (id, name, handle) values (:J, 'Jake Rivera', 'jake');
reset role;

create function t.last_body(u uuid) returns text language sql as
  $$ select body from public.notification_outbox where user_id = u order by id desc limit 1 $$;
create function t.outbox_count() returns bigint language sql as $$ select count(*) from public.notification_outbox $$;
grant execute on all functions in schema t to authenticated, service_role;

-- Money formatting
select t.ok(public._fmt_money(2000) = '$20' and public._fmt_money(2050) = '$20.50' and public._fmt_money(124050) = '$1,240.50' and public._fmt_money(5) = '$0.05', 'money is formatted like the app');

-- Payments and requests enqueue the right messages for the right person.
set role authenticated;
select t.login(:J);
select public.send_payment(:M, 2000, 'Pizza') is not null as s1 \gset
reset role;
select t.ok(t.last_body(:M) = 'Jake paid you $20 · Pizza', 'payment → "Jake paid you $20 · Pizza" to Matthew');
select t.ok((select data->>'url' from public.notification_outbox where user_id = :M order by id desc limit 1) like '/transaction/%', 'tapping it opens the transaction');
select t.ok((select count(*) from public.notification_outbox where user_id = :J) = 0, 'the sender gets no push');

set role authenticated;
select t.login(:M);
select public.create_request(:J, 1850, 'Tacos') -> 'transaction' ->> 'id' as req \gset
reset role;
select t.ok(t.last_body(:J) = 'Matthew is requesting $18.50 · Tacos', 'request → "Matthew is requesting $18.50 · Tacos" to Jake');
select t.ok((select data->>'url' from public.notification_outbox where user_id = :J order by id desc limit 1) = '/request/' || :'req', 'tapping it opens the request');

set role authenticated;
select t.login(:J);
select public.pay_request(:'req') is not null as paid \gset
reset role;
select t.ok(t.last_body(:M) = 'Jake paid your $18.50 request · Tacos', 'paid request → requester is told');

set role authenticated;
select t.login(:M);
select public.create_request(:J, 700, '') -> 'transaction' ->> 'id' as req2 \gset
select t.login(:J);
select public.decline_request(:'req2') is not null as declined \gset
reset role;
select t.ok(t.last_body(:M) = 'Jake declined your $7 request', 'declined request → requester is told (no empty note)');

-- Settings are respected.
set role authenticated;
select t.login(:M);
update public.settings set notify_payments = false;
select t.login(:J);
select public.send_payment(:M, 100, 'Gum') is not null as s2 \gset
reset role;
select t.ok(t.last_body(:M) = 'Jake declined your $7 request', 'payments toggle off → no payment push');
set role authenticated;
select t.login(:M);
update public.settings set notify_payments = true, notifications_on = false;
select t.login(:J);
select public.send_payment(:M, 100, 'Gum') is not null as s3 \gset
reset role;
select t.ok(t.last_body(:M) = 'Jake declined your $7 request', 'notifications off → nothing at all');

-- Push tokens
set role authenticated;
select t.login(:M);
select public.register_push_token('ExponentPushToken[abc123]', 'ios');
select t.throws($$select public.register_push_token('not-a-token', 'ios')$$, 'check', 'only Expo push tokens are accepted');
select t.throws($$insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[x]', '00000000-0000-0000-0000-00000000aa02', 'ios')$$, 'permission denied', 'no direct writes to push tokens');
select t.login(:J);
select t.ok((select count(*) from public.push_tokens) = 0, 'you only see your own tokens');
select public.register_push_token('ExponentPushToken[abc123]', 'ios');
select t.ok((select count(*) from public.push_tokens) = 1, 'a phone that changes accounts moves its token to the new account');
select t.login(:M);
select public.unregister_push_token('ExponentPushToken[abc123]');
select t.login(:J);
select t.ok((select count(*) from public.push_tokens) = 1, 'you cannot unregister someone else''s token');
select t.throws($$select * from public.notification_outbox$$, 'permission denied', 'the app cannot read the outbox');
select t.throws($$select * from public.claim_notifications(10)$$, 'permission denied', 'the app cannot claim notifications');
reset role;

-- Delivery claims each notification exactly once.
set role service_role;
select count(*) as claimed1 from public.claim_notifications(100) \gset
select count(*) as claimed2 from public.claim_notifications(100) \gset
select t.ok(:claimed1 = 5 and :claimed2 = 0, 'each notification is claimed once');
select t.ok((select tokens from public.claim_notifications(100) limit 1) is null, 'nothing left to claim');
reset role;

-- QR payment refs
set role authenticated;
select t.login(:J);
select public.send_payment(:M, 1200, 'Lunch', 'k3v9x2m7q1') -> 'transaction' ->> 'ref' as ref \gset
select t.ok(:'ref' = 'k3v9x2m7q1', 'a payment for a request code carries its ref');
select t.throws($$select public.send_payment('00000000-0000-0000-0000-00000000aa01', 100, '', 'BAD REF!')$$, 'check', 'refs are validated');
select t.ok((public.send_payment(:M, 100, 'x') -> 'transaction' ->> 'ref') is null, 'ordinary payments have no ref');
reset role;
