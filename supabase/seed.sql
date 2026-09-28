-- DEV / DEMO ONLY. Do not run on a production project.
--
-- Adds three demo people (Jake, Priya, Sofia) so a single phone can try the whole flow
-- against a real Supabase backend, plus two helpers the app's
-- Profile → Prototype buttons call to simulate the other phone:
--   demo_incoming_payment()  "Jake paid you $20 · Pizza"
--   demo_incoming_request()  "Priya is requesting $14.50 · Movie night"
-- Both only ever move TEST money.

insert into auth.users (id, phone) values
  ('d0000000-0000-4000-8000-00000000000a', '15550000001'),
  ('d0000000-0000-4000-8000-00000000000b', '15550000002'),
  ('d0000000-0000-4000-8000-00000000000c', '15550000003')
on conflict (id) do nothing;

insert into public.wallets (user_id) values
  ('d0000000-0000-4000-8000-00000000000a'),
  ('d0000000-0000-4000-8000-00000000000b'),
  ('d0000000-0000-4000-8000-00000000000c')
on conflict do nothing;

insert into public.users (id, name, handle) values
  ('d0000000-0000-4000-8000-00000000000a', 'Jake Rivera', 'jake'),
  ('d0000000-0000-4000-8000-00000000000b', 'Priya Shah', 'priya'),
  ('d0000000-0000-4000-8000-00000000000c', 'Sofia Martins', 'sofia')
on conflict do nothing;

create or replace function public.demo_incoming_payment()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public._require_user();
  jake constant uuid := 'd0000000-0000-4000-8000-00000000000a';
begin
  if me = jake then return; end if;
  update public.wallets set balance_cents = balance_cents + 2000, updated_at = now() where user_id = me;
  insert into public.transactions (from_user, to_user, amount_cents, note, type, status, completed_at)
    values (jake, me, 2000, 'Pizza', 'send', 'completed', now());
  perform public._remember(me, jake);
end;
$$;

create or replace function public.demo_incoming_request()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public._require_user();
  priya constant uuid := 'd0000000-0000-4000-8000-00000000000b';
begin
  if me = priya then return; end if;
  insert into public.transactions (from_user, to_user, amount_cents, note, type, status)
    values (me, priya, 1450, 'Movie night', 'request', 'pending');
  perform public._remember(me, priya);
end;
$$;

revoke execute on function public.demo_incoming_payment(), public.demo_incoming_request() from public, anon;
grant execute on function public.demo_incoming_payment(), public.demo_incoming_request() to authenticated;
