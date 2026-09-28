-- Step 5: Bluetooth tap + Apple Nearby Interaction (UWB).
--
-- A phone on the Tap screen opens a 60-second tap session and advertises its ble_token
-- over Bluetooth. On UWB iPhones it also stores its Nearby Interaction discovery token
-- (ni_token). When another phone that is ALSO on the Tap screen resolves the BLE token,
-- it gets the public profile plus the ni_token, so the two iPhones can measure their
-- exact distance before anything is shown.

alter table public.tap_sessions
  add column ni_token text check (char_length(ni_token) <= 4096);

drop function public.start_tap_session(bigint, text);
create function public.start_tap_session(p_amount_cents bigint, p_mode text, p_ni_token text default null)
returns public.tap_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public._require_user();
  s public.tap_sessions;
begin
  delete from public.tap_sessions where user_id = me;
  insert into public.tap_sessions (user_id, amount_cents, mode, ble_token, ni_token)
    values (me, p_amount_cents, p_mode, encode(extensions.gen_random_bytes(12), 'hex'), p_ni_token)
    returning * into s;
  return s;
end;
$$;

drop function public.resolve_tap_token(text);
create function public.resolve_tap_token(p_token text)
returns table (id uuid, name text, handle text, avatar_url text, mode text, amount_cents bigint, ni_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public._require_user();
begin
  if not exists (select 1 from public.tap_sessions where user_id = me and expires_at > now()) then
    raise exception 'no_active_session' using errcode = 'P0001';
  end if;
  return query
    select u.id, u.name, u.handle, u.avatar_url, s.mode, s.amount_cents, s.ni_token
    from public.tap_sessions s join public.users u on u.id = s.user_id
    where s.ble_token = lower(p_token) and s.expires_at > now() and s.user_id <> me;
end;
$$;

revoke execute on function public.start_tap_session(bigint, text, text), public.resolve_tap_token(text) from public, anon;
grant execute on function public.start_tap_session(bigint, text, text), public.resolve_tap_token(text) to authenticated;
