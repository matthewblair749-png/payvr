-- Demo helpers from supabase/seed.sql.
\set ON_ERROR_STOP 1
\ir helpers.inc.sql
\ir ../seed.sql
set client_min_messages = notice;
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000f1', '19995550000');
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000f1');
insert into public.users (id, name, handle) values ('00000000-0000-0000-0000-0000000000f1', 'Demo Tester', 'tester');
select t.ok((select count(*) from public.lookup_handle('jake')) = 1, 'seed: demo Jake is findable by QR handle');
select public.demo_incoming_payment();
select t.ok((select balance_cents from public.wallets) = 52000, 'seed: Jake pays you $20');
select t.ok((select name from public.users u join public.transactions tx on tx.from_user = u.id limit 1) = 'Jake Rivera', 'seed: Jake is visible after paying you');
select public.demo_incoming_payment(1234, 'QR request');
select t.ok((select balance_cents from public.wallets) = 53234, 'seed: Jake pays a custom amount (QR request demo)');
select t.throws($$select public.demo_incoming_payment(0)$$, 'invalid_amount', 'seed: demo payment rejects $0');
select public.demo_incoming_request();
select t.ok((select count(*) from public.transactions where type = 'request' and status = 'pending') = 1, 'seed: Priya requests from you');
reset role;
