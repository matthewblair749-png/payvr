-- Supabase grants EXECUTE on every new function in `public` to anon and authenticated.
-- The internal helpers (names starting with "_") and trigger functions are only meant to be
-- called from inside other functions, so lock them down explicitly. (They were already
-- harmless when called directly, since they run with the caller's limited rights, but this
-- makes it impossible.)
revoke execute on function
  public._require_user(),
  public._sent_last_24h(uuid),
  public._move_money(uuid, uuid, bigint),
  public._remember(uuid, uuid),
  public.handle_new_auth_user(),
  public.set_user_phone()
from public, anon, authenticated;
