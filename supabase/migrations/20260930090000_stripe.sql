-- Step 6: Stripe test mode.
--
-- Payments between Payvr users stay on the internal ledger (instant and atomic, see the
-- first migration). Stripe sits at the edges:
--   * Add money: a Stripe PaymentIntent charges a card (Stripe PaymentSheet in the app).
--     The Stripe webhook credits the wallet, exactly once per PaymentIntent.
--   * Cash out: Stripe Connect. Each user onboards an Express connected account; a cash-out
--     debits the wallet, then creates a Stripe Transfer to that account. If Stripe
--     fails, the money goes back to the wallet.
-- Only the Edge Functions (service role) call the functions below; the app cannot.
-- Card numbers never reach Payvr: the app talks to Stripe directly.

-- ─────────────────────────────────────────────────────────── settings

create table public.app_settings (
  key    text primary key,
  value  text not null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
-- 'off' = prototype test-money shortcuts; 'test' = Stripe test mode is the only way in/out.
insert into public.app_settings (key, value) values ('stripe_mode', 'off');

create function public._stripe_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.app_settings where key = 'stripe_mode'), 'off') <> 'off';
$$;

-- Once Stripe is on, the free test-money shortcuts stop working.
create or replace function public.add_test_money(p_amount_cents bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public._require_user();
  new_balance bigint;
begin
  if public._stripe_enabled() then
    raise exception 'stripe_required' using errcode = 'P0001';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 100000 then
    raise exception 'invalid_amount' using errcode = 'P0001', hint = 'Up to $1,000 at a time.';
  end if;
  update public.wallets set balance_cents = balance_cents + p_amount_cents, updated_at = now()
    where user_id = me returning balance_cents into new_balance;
  return new_balance;
end;
$$;

create or replace function public.cash_out(p_amount_cents bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public._require_user();
  new_balance bigint;
begin
  if public._stripe_enabled() then
    raise exception 'stripe_required' using errcode = 'P0001';
  end if;
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

-- ─────────────────────────────────────────────────────────── tables

create table public.stripe_accounts (
  user_id             uuid primary key references public.users (id) on delete cascade,
  customer_id         text unique,
  connect_account_id  text unique,
  payouts_enabled     boolean not null default false,
  updated_at          timestamptz not null default now()
);

create table public.wallet_topups (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  amount_cents       bigint not null check (amount_cents > 0 and amount_cents <= 100000),
  payment_intent_id  text not null unique,
  status             text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  created_at         timestamptz not null default now(),
  completed_at       timestamptz
);
create index wallet_topups_user_idx on public.wallet_topups (user_id, created_at desc);

create table public.wallet_cashouts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id) on delete cascade,
  amount_cents     bigint not null check (amount_cents > 0),
  transfer_id      text unique,
  status           text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  failure_reason   text,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);
create index wallet_cashouts_user_idx on public.wallet_cashouts (user_id, created_at desc);

alter table public.stripe_accounts enable row level security;
alter table public.wallet_topups   enable row level security;
alter table public.wallet_cashouts enable row level security;

create policy "stripe_accounts: read own" on public.stripe_accounts
  for select to authenticated using (user_id = auth.uid());
create policy "wallet_topups: read own" on public.wallet_topups
  for select to authenticated using (user_id = auth.uid());
create policy "wallet_cashouts: read own" on public.wallet_cashouts
  for select to authenticated using (user_id = auth.uid());

revoke all on public.stripe_accounts, public.wallet_topups, public.wallet_cashouts from anon, authenticated;
grant select on public.stripe_accounts, public.wallet_topups, public.wallet_cashouts to authenticated;
-- The Edge Functions (service role) read accounts directly; don't rely on project defaults.
grant select on public.stripe_accounts, public.wallet_topups, public.wallet_cashouts to service_role;

-- ─────────────────────────────────────────────────────────── service-role functions

create function public.stripe_save_account(p_user uuid, p_customer_id text, p_connect_account_id text, p_payouts_enabled boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.stripe_accounts (user_id, customer_id, connect_account_id, payouts_enabled)
  values (p_user, p_customer_id, p_connect_account_id, coalesce(p_payouts_enabled, false))
  on conflict (user_id) do update set
    customer_id        = coalesce(excluded.customer_id, public.stripe_accounts.customer_id),
    connect_account_id = coalesce(excluded.connect_account_id, public.stripe_accounts.connect_account_id),
    payouts_enabled    = coalesce(p_payouts_enabled, public.stripe_accounts.payouts_enabled),
    updated_at         = now();
$$;

-- account.updated webhook: payouts switch on once onboarding is complete.
create function public.stripe_set_payouts_enabled(p_connect_account_id text, p_enabled boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.stripe_accounts set payouts_enabled = p_enabled, updated_at = now()
  where connect_account_id = p_connect_account_id;
$$;

create function public.stripe_record_topup(p_user uuid, p_amount_cents bigint, p_payment_intent_id text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.wallet_topups (user_id, amount_cents, payment_intent_id)
  values (p_user, p_amount_cents, p_payment_intent_id)
  on conflict (payment_intent_id) do update set amount_cents = public.wallet_topups.amount_cents
  returning id;
$$;

-- payment_intent.succeeded webhook. Idempotent: Stripe may deliver the same event twice.
-- The amount credited is the amount Stripe actually charged, checked against the record.
create function public.stripe_credit_topup(p_payment_intent_id text, p_amount_received bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.wallet_topups;
  new_balance bigint;
begin
  select * into t from public.wallet_topups where payment_intent_id = p_payment_intent_id for update;
  if not found then
    raise exception 'unknown_payment_intent' using errcode = 'P0001';
  end if;
  if t.status = 'succeeded' then
    return (select balance_cents from public.wallets where user_id = t.user_id);
  end if;
  if p_amount_received <> t.amount_cents then
    raise exception 'amount_mismatch' using errcode = 'P0001';
  end if;
  update public.wallet_topups set status = 'succeeded', completed_at = now() where id = t.id;
  update public.wallets set balance_cents = balance_cents + t.amount_cents, updated_at = now()
    where user_id = t.user_id returning balance_cents into new_balance;
  return new_balance;
end;
$$;

create function public.stripe_fail_topup(p_payment_intent_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.wallet_topups set status = 'failed', completed_at = now()
  where payment_intent_id = p_payment_intent_id and status = 'pending';
$$;

-- Step 1 of a cash-out: take the money out of the wallet first (so it can't be spent twice).
create function public.stripe_begin_cashout(p_user uuid, p_amount_cents bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cashout_id uuid;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.stripe_accounts where user_id = p_user and payouts_enabled) then
    raise exception 'payouts_not_ready' using errcode = 'P0001';
  end if;
  update public.wallets set balance_cents = balance_cents - p_amount_cents, updated_at = now()
    where user_id = p_user and balance_cents >= p_amount_cents;
  if not found then
    raise exception 'insufficient_funds' using errcode = 'P0001';
  end if;
  insert into public.wallet_cashouts (user_id, amount_cents) values (p_user, p_amount_cents)
    returning id into cashout_id;
  return cashout_id;
end;
$$;

-- Step 2a: Stripe accepted the transfer.
create function public.stripe_complete_cashout(p_cashout_id uuid, p_transfer_id text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.wallet_cashouts;
begin
  update public.wallet_cashouts set status = 'paid', transfer_id = p_transfer_id, completed_at = now()
    where id = p_cashout_id and status = 'pending'
    returning * into c;
  if not found then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  return (select balance_cents from public.wallets where user_id = c.user_id);
end;
$$;

-- Step 2b: Stripe refused. Put the money back.
create function public.stripe_fail_cashout(p_cashout_id uuid, p_reason text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.wallet_cashouts;
  new_balance bigint;
begin
  update public.wallet_cashouts set status = 'failed', failure_reason = left(p_reason, 500), completed_at = now()
    where id = p_cashout_id and status = 'pending'
    returning * into c;
  if not found then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  update public.wallets set balance_cents = balance_cents + c.amount_cents, updated_at = now()
    where user_id = c.user_id returning balance_cents into new_balance;
  return new_balance;
end;
$$;

revoke execute on function
  public._stripe_enabled(),
  public.stripe_save_account(uuid, text, text, boolean),
  public.stripe_set_payouts_enabled(text, boolean),
  public.stripe_record_topup(uuid, bigint, text),
  public.stripe_credit_topup(text, bigint),
  public.stripe_fail_topup(text),
  public.stripe_begin_cashout(uuid, bigint),
  public.stripe_complete_cashout(uuid, text),
  public.stripe_fail_cashout(uuid, text)
from public, anon, authenticated;
grant execute on function
  public.stripe_save_account(uuid, text, text, boolean),
  public.stripe_set_payouts_enabled(text, boolean),
  public.stripe_record_topup(uuid, bigint, text),
  public.stripe_credit_topup(text, bigint),
  public.stripe_fail_topup(text),
  public.stripe_begin_cashout(uuid, bigint),
  public.stripe_complete_cashout(uuid, text),
  public.stripe_fail_cashout(uuid, text)
to service_role;

-- The app learns about completed top-ups over realtime.
alter publication supabase_realtime add table public.wallet_topups;
