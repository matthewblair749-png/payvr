-- Internal helpers can't be called from the app, even with Supabase's default grants.
\set ON_ERROR_STOP 1
\ir helpers.inc.sql
set client_min_messages = notice;
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000f7', '7');
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000f7');
insert into public.users (id, name, handle) values ('00000000-0000-0000-0000-0000000000f7', 'Hal Harden', 'hal');
select t.throws($$select public._move_money('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000000f7', 1)$$, 'permission denied', '_move_money is not callable');
select t.throws($$select public._remember('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000000f7')$$, 'permission denied', '_remember is not callable');
select t.throws($$select public._sent_last_24h('00000000-0000-0000-0000-0000000000f7')$$, 'permission denied', '_sent_last_24h is not callable');
select t.throws($$select public._stripe_enabled()$$, 'permission denied', '_stripe_enabled is not callable');
-- …while the public functions still work.
select t.ok(public.add_test_money(100) = 50100, 'public RPCs still work');
reset role;
set role anon;
select t.throws($$select public.lookup_handle('hal')$$, 'permission denied', 'anon cannot look up handles');
reset role;
