-- Tap sessions with Nearby Interaction tokens (step 5).
\set ON_ERROR_STOP 1
\ir helpers.inc.sql
set client_min_messages = notice;

insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-0000000000a1', '1'),
  ('00000000-0000-0000-0000-0000000000b1', '2'),
  ('00000000-0000-0000-0000-0000000000c1', '3');
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000a1');
insert into public.users (id, name, handle) values ('00000000-0000-0000-0000-0000000000a1', 'Ann Tapper', 'ann');
select t.login('00000000-0000-0000-0000-0000000000b1');
insert into public.users (id, name, handle) values ('00000000-0000-0000-0000-0000000000b1', 'Ben Tapper', 'ben');
select t.login('00000000-0000-0000-0000-0000000000c1');
insert into public.users (id, name, handle) values ('00000000-0000-0000-0000-0000000000c1', 'Cat Sniffer', 'cat');

-- Ann (UWB iPhone) and Ben (Android, no UWB) open the Tap screen.
select t.login('00000000-0000-0000-0000-0000000000a1');
select ble_token as tok_ann from public.start_tap_session(2000, 'send', 'QU5OLU5JLVRPS0VO') \gset
select t.login('00000000-0000-0000-0000-0000000000b1');
select ble_token as tok_ben from public.start_tap_session(2000, 'request') \gset

select t.ok((select ni_token from public.resolve_tap_token(:'tok_ann')) = 'QU5OLU5JLVRPS0VO', 'Ben gets Ann''s Nearby Interaction token when he resolves her');
select t.ok((select mode from public.resolve_tap_token(:'tok_ann')) = 'send', 'resolve returns the other phone''s mode');
select t.ok((select count(*) from public.resolve_tap_token(upper(:'tok_ann'))) = 1, 'tokens resolve case-insensitively (iOS reports upper-case UUIDs)');

select t.login('00000000-0000-0000-0000-0000000000a1');
select t.ok((select name from public.resolve_tap_token(:'tok_ben')) = 'Ben Tapper', 'Ann resolves Ben');
select t.ok((select ni_token from public.resolve_tap_token(:'tok_ben')) is null, 'no NI token for a phone without UWB');
select t.ok((select count(*) from public.resolve_tap_token(:'tok_ann')) = 0, 'you never resolve yourself');

-- Cat heard Ann's token over the air but is not on the Tap screen.
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.throws(format('select * from public.resolve_tap_token(%L)', :'tok_ann'), 'no_active_session', 'a passive listener cannot resolve tokens');
select t.ok((select count(*) from public.tap_sessions) = 0, 'Cat cannot see other people''s tap sessions');

-- Restarting the Tap screen replaces the old session (old token stops working).
select t.login('00000000-0000-0000-0000-0000000000a1');
select ble_token as tok_ann2 from public.start_tap_session(2000, 'send') \gset
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok((select count(*) from public.resolve_tap_token(:'tok_ann')) = 0, 'old token dies when a new session starts');
select t.ok((select count(*) from public.resolve_tap_token(:'tok_ann2')) = 1, 'new token resolves');

-- Leaving the Tap screen ends the session.
select t.login('00000000-0000-0000-0000-0000000000a1');
select public.end_tap_session();
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok((select count(*) from public.resolve_tap_token(:'tok_ann2')) = 0, 'ended sessions cannot be discovered');
select t.throws($$select public.start_tap_session(100, 'send', repeat('x', 5000))$$, 'check', 'NI token size is capped');
reset role;
