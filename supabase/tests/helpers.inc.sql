-- Shared test helpers (included by the *.test.sql files).
-- Test helpers ------------------------------------------------------------
create schema t;
grant usage on schema t to authenticated, anon;

create function t.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'ok - %', label;
end $$;

-- Runs `sql` and asserts it fails with a message containing `expected`.
create function t.throws(sql text, expected text, label text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAIL: % (no error raised)', label;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if position(expected in sqlerrm) = 0 then
    raise exception 'FAIL: % (got "%", wanted "%")', label, sqlerrm, expected;
  end if;
  raise notice 'ok - %', label;
end $$;
grant execute on all functions in schema t to authenticated, anon;

create function t.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
end $$;
grant execute on function t.login(uuid) to authenticated;

