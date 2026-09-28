-- Payvr prototype schema: TEST MONEY ONLY.
--
-- Security model
--  * Row-level security is on for every table. Users can only read their own rows,
--    plus the public profile (name, @handle, photo) of people they have tapped or paid.
--  * The app can never write balances or transactions directly. All money moves through
--    SECURITY DEFINER functions below, which lock wallets, enforce the balance and the
--    $500 rolling 24h send limit, and write the ledger atomically.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────── tables

create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 2 and 60),
  handle      text not null unique check (handle ~ '^[a-z0-9_.]{3,20}$'),
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table public.wallets (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  balance_cents  bigint not null default 50000 check (balance_cents >= 0),
  updated_at     timestamptz not null default now()
);

create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  -- Money always flows from_user -> to_user. For a request, to_user is the requester
  -- and from_user is the person being asked to pay.
  from_user     uuid not null references public.users (id) on delete cascade,
  to_user       uuid not null references public.users (id) on delete cascade,
  amount_cents  bigint not null check (amount_cents > 0 and amount_cents <= 1000000),
  note          text not null default '' check (char_length(note) <= 60),
  type          text not null check (type in ('send', 'request')),
  status        text not null check (status in ('pending', 'completed', 'declined')),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  check (from_user <> to_user)
);
create index transactions_from_idx on public.transactions (from_user, created_at desc);
create index transactions_to_idx on public.transactions (to_user, created_at desc);

create table public.contacts (
  user_id          uuid not null references public.users (id) on delete cascade,
  contact_user_id  uuid not null references public.users (id) on delete cascade,
  last_tapped_at   timestamptz not null default now(),
  primary key (user_id, contact_user_id),
  check (user_id <> contact_user_id)
);

create table public.tap_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  amount_cents  bigint not null check (amount_cents > 0 and amount_cents <= 1000000),
  mode          text not null check (mode in ('send', 'request')),
  ble_token     text not null unique,
  expires_at    timestamptz not null default now() + interval '60 seconds'
);
create index tap_sessions_user_idx on public.tap_sessions (user_id);

create table public.settings (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  theme             text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  notifications_on  boolean not null default true
);

-- ─────────────────────────────────────────────────────────── new accounts

-- Every new auth user gets a $500 test wallet and default settings.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wallets (user_id) values (new.id) on conflict do nothing;
  insert into public.settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- The phone number always comes from the verified auth record, never from the app.
create function public.set_user_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.phone := (select u.phone from auth.users u where u.id = new.id);
  return new;
end;
$$;

create trigger users_set_phone
  before insert on public.users
  for each row execute function public.set_user_phone();

-- ─────────────────────────────────────────────────────────── row-level security

alter table public.users        enable row level security;
alter table public.wallets      enable row level security;
alter table public.transactions enable row level security;
alter table public.contacts     enable row level security;
alter table public.tap_sessions enable row level security;
alter table public.settings     enable row level security;

-- Can the signed-in user see this person's public profile?
-- Yes for yourself, people in your contacts, and anyone you have a transaction with.
create function public.can_see_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target = auth.uid()
      or exists (select 1 from public.contacts c
                 where c.user_id = auth.uid() and c.contact_user_id = target)
      or exists (select 1 from public.transactions t
                 where (t.from_user = auth.uid() and t.to_user = target)
                    or (t.to_user = auth.uid() and t.from_user = target));
$$;

create policy "users: read self and people you know" on public.users
  for select to authenticated using (public.can_see_user(id));
create policy "users: create own profile" on public.users
  for insert to authenticated with check (id = auth.uid());
create policy "users: update own profile" on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "wallets: read own" on public.wallets
  for select to authenticated using (user_id = auth.uid());

create policy "transactions: read own" on public.transactions
  for select to authenticated using (auth.uid() in (from_user, to_user));

create policy "contacts: read own" on public.contacts
  for select to authenticated using (user_id = auth.uid());
create policy "contacts: remove own" on public.contacts
  for delete to authenticated using (user_id = auth.uid());

create policy "tap_sessions: read own" on public.tap_sessions
  for select to authenticated using (user_id = auth.uid());

create policy "settings: read own" on public.settings
  for select to authenticated using (user_id = auth.uid());
create policy "settings: update own" on public.settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Table privileges: nothing for anonymous users; only the columns the app may write.
revoke all on public.users, public.wallets, public.transactions, public.contacts,
              public.tap_sessions, public.settings from anon, authenticated;
grant select on public.users, public.wallets, public.transactions, public.contacts,
                public.tap_sessions, public.settings to authenticated;
grant insert (id, name, handle, avatar_url) on public.users to authenticated;
grant update (name, handle, avatar_url) on public.users to authenticated;
grant update (theme, notifications_on) on public.settings to authenticated;
grant delete on public.contacts to authenticated;

-- ─────────────────────────────────────────────────────────── money (RPC)

create function public._require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.users where id = me) then
    raise exception 'profile_missing' using errcode = 'P0001';
  end if;
  return me;
end;
$$;

-- Total sent in the last 24 hours (payments + paid requests).
create function public._sent_last_24h(p_user uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(amount_cents), 0)::bigint
  from public.transactions
  where from_user = p_user
    and status = 'completed'
    and coalesce(completed_at, created_at) > now() - interval '24 hours';
$$;

-- Moves money between two wallets with balance + daily-limit checks. Caller holds no locks.
create function public._move_money(p_from uuid, p_to uuid, p_amount bigint)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  daily_limit constant bigint := 50000;
  sent bigint;
  from_balance bigint;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  -- Lock both wallets in a stable order so concurrent payments cannot deadlock.
  perform 1 from public.wallets
    where user_id in (p_from, p_to)
    order by user_id
    for update;

  select balance_cents into from_balance from public.wallets where user_id = p_from;
  if from_balance is null then
    raise exception 'wallet_missing' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.wallets where user_id = p_to) then
    raise exception 'recipient_missing' using errcode = 'P0001';
  end if;
  if from_balance < p_amount then
    raise exception 'insufficient_funds' using errcode = 'P0001';
  end if;
  sent := public._sent_last_24h(p_from);
  if sent + p_amount > daily_limit then
    raise exception 'daily_limit' using errcode = 'P0001', hint = (daily_limit - sent)::text;
  end if;

  update public.wallets set balance_cents = balance_cents - p_amount, updated_at = now()
    where user_id = p_from
    returning balance_cents into from_balance;
  update public.wallets set balance_cents = balance_cents + p_amount, updated_at = now()
    where user_id = p_to;
  return from_balance;
end;
$$;

-- Saves both people as each other's contact (anyone you tap or pay).
create function public._remember(p_a uuid, p_b uuid)
returns void
language sql
set search_path = ''
as $$
  insert into public.contacts (user_id, contact_user_id, last_tapped_at)
  values (p_a, p_b, now()), (p_b, p_a, now())
  on conflict (user_id, contact_user_id) do update set last_tapped_at = excluded.last_tapped_at;
$$;

create function public.send_payment(p_to uuid, p_amount_cents bigint, p_note text default '')
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public._require_user();
  new_balance bigint;
  tx public.transactions;
begin
  if p_to = me then
    raise exception 'invalid_recipient' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.users where id = p_to) then
    raise exception 'recipient_missing' using errcode = 'P0001';
  end if;
  new_balance := public._move_money(me, p_to, p_amount_cents);
  insert into public.transactions (from_user, to_user, amount_cents, note, type, status, completed_at)
    values (me, p_to, p_amount_cents, left(coalesce(btrim(p_note), ''), 60), 'send', 'completed', now())
    returning * into tx;
  perform public._remember(me, p_to);
  return json_build_object('transaction', row_to_json(tx), 'balance_cents', new_balance);
end;
$$;

create function public.create_request(p_from uuid, p_amount_cents bigint, p_note text default '')
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public._require_user();
  tx public.transactions;
begin
  if p_from = me then
    raise exception 'invalid_recipient' using errcode = 'P0001';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 1000000 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.users where id = p_from) then
    raise exception 'recipient_missing' using errcode = 'P0001';
  end if;
  insert into public.transactions (from_user, to_user, amount_cents, note, type, status)
    values (p_from, me, p_amount_cents, left(coalesce(btrim(p_note), ''), 60), 'request', 'pending')
    returning * into tx;
  perform public._remember(me, p_from);
  return json_build_object('transaction', row_to_json(tx),
    'balance_cents', (select balance_cents from public.wallets where user_id = me));
end;
$$;

create function public.pay_request(p_request_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public._require_user();
  tx public.transactions;
  new_balance bigint;
begin
  select * into tx from public.transactions
    where id = p_request_id and type = 'request' and from_user = me
    for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if tx.status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  new_balance := public._move_money(me, tx.to_user, tx.amount_cents);
  update public.transactions set status = 'completed', completed_at = now()
    where id = tx.id returning * into tx;
  perform public._remember(me, tx.to_user);
  return json_build_object('transaction', row_to_json(tx), 'balance_cents', new_balance);
end;
$$;

create function public.decline_request(p_request_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public._require_user();
  tx public.transactions;
begin
  update public.transactions set status = 'declined'
    where id = p_request_id and type = 'request' and from_user = me and status = 'pending'
    returning * into tx;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return json_build_object('transaction', row_to_json(tx),
    'balance_cents', (select balance_cents from public.wallets where user_id = me));
end;
$$;

-- TEST MONEY: in production this is a Stripe top-up confirmed by a webhook, not an RPC.
create function public.add_test_money(p_amount_cents bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public._require_user();
  new_balance bigint;
begin
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 100000 then
    raise exception 'invalid_amount' using errcode = 'P0001', hint = 'Up to $1,000 at a time.';
  end if;
  update public.wallets set balance_cents = balance_cents + p_amount_cents, updated_at = now()
    where user_id = me returning balance_cents into new_balance;
  return new_balance;
end;
$$;

-- TEST MONEY: in production this is a Stripe payout.
create function public.cash_out(p_amount_cents bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public._require_user();
  new_balance bigint;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  update public.wallets set balance_cents = balance_cents - p_amount_cents, updated_at = now()
    where user_id = me and balance_cents >= p_amount_cents
    returning balance_cents into new_balance;
  if new_balance is null then
    raise exception 'insufficient_funds' using errcode = 'P0001';
  end if;
  return new_balance;
end;
$$;

-- ─────────────────────────────────────────────────────────── people lookup

-- Public profile for a QR code handle. Only name, handle and photo are returned.
create function public.lookup_handle(p_handle text)
returns table (id uuid, name text, handle text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.name, u.handle, u.avatar_url
  from public.users u
  where auth.uid() is not null and u.handle = lower(btrim(p_handle));
$$;

create function public.handle_available(p_handle text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and lower(btrim(p_handle)) ~ '^[a-z0-9_.]{3,20}$'
     and not exists (select 1 from public.users u
                     where u.handle = lower(btrim(p_handle)) and u.id <> auth.uid());
$$;

-- ─────────────────────────────────────────────────────────── tap sessions (build step 5)

-- Opens a 60-second tap session and returns the short-lived token to advertise over BLE.
create function public.start_tap_session(p_amount_cents bigint, p_mode text)
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
  insert into public.tap_sessions (user_id, amount_cents, mode, ble_token)
    values (me, p_amount_cents, p_mode, encode(extensions.gen_random_bytes(12), 'hex'))
    returning * into s;
  return s;
end;
$$;

create function public.end_tap_session()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.tap_sessions where user_id = auth.uid();
$$;

-- Resolves a token heard over BLE into the other person's public profile.
-- Only works while both people have a live (unexpired) tap session open.
create function public.resolve_tap_token(p_token text)
returns table (id uuid, name text, handle text, avatar_url text, mode text, amount_cents bigint)
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
    select u.id, u.name, u.handle, u.avatar_url, s.mode, s.amount_cents
    from public.tap_sessions s join public.users u on u.id = s.user_id
    where s.ble_token = p_token and s.expires_at > now() and s.user_id <> me;
end;
$$;

-- ─────────────────────────────────────────────────────────── function privileges

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.send_payment(uuid, bigint, text),
  public.create_request(uuid, bigint, text),
  public.pay_request(uuid),
  public.decline_request(uuid),
  public.add_test_money(bigint),
  public.cash_out(bigint),
  public.lookup_handle(text),
  public.handle_available(text),
  public.start_tap_session(bigint, text),
  public.end_tap_session(),
  public.resolve_tap_token(text),
  public.can_see_user(uuid)
to authenticated;

-- ─────────────────────────────────────────────────────────── realtime

-- Realtime respects RLS, so each phone only receives its own rows.
alter publication supabase_realtime add table public.transactions, public.wallets;

-- ─────────────────────────────────────────────────────────── avatar storage

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Photos live at avatars/<user id>/<file>. Anyone can view; only the owner can write.
create policy "avatars: owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner can update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
