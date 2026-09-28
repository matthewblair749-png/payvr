-- Step 7: push notifications, and tying QR-request payments to the exact code scanned.

-- ─────────────────────────────────────────────────────────── settings

alter table public.settings
  add column notify_payments boolean not null default true,
  add column notify_requests boolean not null default true;
grant update (notify_payments, notify_requests) on public.settings to authenticated;

-- ─────────────────────────────────────────────────────────── push tokens

-- One row per device (Expo push token). A token follows whoever last signed in on that phone.
create table public.push_tokens (
  token       text primary key check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'),
  user_id     uuid not null references public.users (id) on delete cascade,
  platform    text not null check (platform in ('ios', 'android')),
  updated_at  timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
create policy "push_tokens: read own" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
revoke all on public.push_tokens from anon, authenticated;
grant select on public.push_tokens to authenticated;
grant select, delete on public.push_tokens to service_role;

create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public._require_user();
begin
  insert into public.push_tokens (token, user_id, platform) values (p_token, me, p_platform)
  on conflict (token) do update set user_id = me, platform = excluded.platform, updated_at = now();
end;
$$;

create function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────── notification outbox

-- Written in the same transaction as the money move, so a notification is never lost
-- (or sent for money that didn't move). The push-send Edge Function delivers them.
create table public.notification_outbox (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.users (id) on delete cascade,
  kind        text not null check (kind in ('payment', 'request')),
  body        text not null,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  error       text
);
create index notification_outbox_unsent_idx on public.notification_outbox (id) where sent_at is null;
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;
grant select, update on public.notification_outbox to service_role;

-- "$20", "$20.50", "$1,240.50"
create function public._fmt_money(p_cents bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select '$' || case
    when p_cents % 100 = 0 then trim(to_char(p_cents / 100, 'FM999,999,999'))
    else trim(to_char(p_cents / 100.0, 'FM999,999,990.00'))
  end;
$$;

create function public._enqueue_notification(p_user uuid, p_kind text, p_body text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.settings;
begin
  select * into s from public.settings where user_id = p_user;
  if s is not null and (not s.notifications_on
      or (p_kind = 'payment' and not s.notify_payments)
      or (p_kind = 'request' and not s.notify_requests)) then
    return;
  end if;
  insert into public.notification_outbox (user_id, kind, body, data) values (p_user, p_kind, p_body, p_data);
end;
$$;

create function public._notify_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender text;
  receiver text;
  amount text := public._fmt_money(new.amount_cents);
  note text := case when coalesce(new.note, '') = '' then '' else ' · ' || new.note end;
begin
  select split_part(name, ' ', 1) into sender from public.users where id = new.from_user;
  select split_part(name, ' ', 1) into receiver from public.users where id = new.to_user;

  if tg_op = 'INSERT' and new.type = 'send' and new.status = 'completed' then
    -- "Jake paid you $20 · Pizza"
    perform public._enqueue_notification(new.to_user, 'payment',
      sender || ' paid you ' || amount || note,
      jsonb_build_object('url', '/transaction/' || new.id));
  elsif tg_op = 'INSERT' and new.type = 'request' and new.status = 'pending' then
    -- "Matthew is requesting $20 · Pizza"
    perform public._enqueue_notification(new.from_user, 'request',
      receiver || ' is requesting ' || amount || note,
      jsonb_build_object('url', '/request/' || new.id));
  elsif tg_op = 'UPDATE' and new.type = 'request' and old.status = 'pending' and new.status = 'completed' then
    perform public._enqueue_notification(new.to_user, 'payment',
      sender || ' paid your ' || amount || ' request' || note,
      jsonb_build_object('url', '/transaction/' || new.id));
  elsif tg_op = 'UPDATE' and new.type = 'request' and old.status = 'pending' and new.status = 'declined' then
    perform public._enqueue_notification(new.to_user, 'request',
      sender || ' declined your ' || amount || ' request',
      jsonb_build_object('url', '/transaction/' || new.id));
  end if;
  return new;
end;
$$;

create trigger transactions_notify
  after insert or update of status on public.transactions
  for each row execute function public._notify_transaction();

-- push-send claims unsent notifications (safe to run concurrently or repeatedly).
create function public.claim_notifications(p_limit int default 100)
returns table (id bigint, user_id uuid, kind text, body text, data jsonb, tokens text[])
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.notification_outbox o set sent_at = now()
    where o.id in (
      select id from public.notification_outbox
      where sent_at is null
      order by id
      limit greatest(1, least(p_limit, 500))
      for update skip locked
    )
    returning o.id, o.user_id, o.kind, o.body, o.data
  )
  select c.id, c.user_id, c.kind, c.body, c.data,
         coalesce((select array_agg(t.token) from public.push_tokens t where t.user_id = c.user_id), '{}')
  from claimed c
  order by c.id;
$$;

create function public.record_notification_error(p_id bigint, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_outbox set error = left(p_error, 500) where id = p_id;
$$;

-- ─────────────────────────────────────────────────────────── QR request references

-- A request QR code carries a random ref; paying it stores the ref on the payment, so the
-- requester's phone matches exactly the payment for *its* code (not just the same amount).
alter table public.transactions add column ref text check (ref ~ '^[a-z0-9]{8,24}$');

drop function public.send_payment(uuid, bigint, text);
create function public.send_payment(p_to uuid, p_amount_cents bigint, p_note text default '', p_ref text default null)
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
  insert into public.transactions (from_user, to_user, amount_cents, note, type, status, completed_at, ref)
    values (me, p_to, p_amount_cents, left(coalesce(btrim(p_note), ''), 60), 'send', 'completed', now(), nullif(p_ref, ''))
    returning * into tx;
  perform public._remember(me, p_to);
  return json_build_object('transaction', row_to_json(tx), 'balance_cents', new_balance);
end;
$$;

-- ─────────────────────────────────────────────────────────── privileges

revoke execute on function
  public.register_push_token(text, text),
  public.unregister_push_token(text),
  public.send_payment(uuid, bigint, text, text),
  public._fmt_money(bigint),
  public._enqueue_notification(uuid, text, text, jsonb),
  public._notify_transaction(),
  public.claim_notifications(int),
  public.record_notification_error(bigint, text)
from public, anon, authenticated;
grant execute on function
  public.register_push_token(text, text),
  public.unregister_push_token(text),
  public.send_payment(uuid, bigint, text, text)
to authenticated;
grant execute on function public.claim_notifications(int), public.record_notification_error(bigint, text) to service_role;
