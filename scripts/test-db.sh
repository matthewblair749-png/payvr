#!/usr/bin/env bash
# Applies supabase/migrations to a throwaway local Postgres (with stand-ins for Supabase's
# auth/storage schemas) and runs the tests in supabase/tests, each in a fresh database.
# Needs Postgres 15+ binaries (initdb, pg_ctl, psql). Usage: npm run test:db
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PATH="$PGBIN:$PATH"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-55432}"

# Postgres refuses to run as root; drop to the postgres user when needed.
AS=()
if [ "$(id -u)" = "0" ]; then
  AS=(runuser -u postgres --)
  chown postgres "$WORK"
fi

cleanup() { "${AS[@]}" pg_ctl -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${AS[@]}" initdb -D "$WORK/data" -U postgres --auth=trust >/dev/null
"${AS[@]}" pg_ctl -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses='' -c wal_level=logical" \
  -l "$WORK/log" -w start >/dev/null

# Creates database $1 with the Supabase stand-ins and all migrations applied; sets PSQL.
fresh_db() {
  "${AS[@]}" createdb -h "$WORK" -p "$PORT" -U postgres "$1"
  PSQL=("${AS[@]}" psql -h "$WORK" -p "$PORT" -U postgres -d "$1" -v ON_ERROR_STOP=1 -q -X)
  "${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stubs.sql" 2>&1 | grep -v -e 'wal_level' -e 'HINT' || true
  for m in "$ROOT"/supabase/migrations/*.sql; do
    "${PSQL[@]}" -f "$m" 2>&1 | grep -v 'already exists, skipping' || true
    [ "${PIPESTATUS[0]}" = "0" ] || { echo "FAILED to apply $(basename "$m")"; exit 1; }
  done
}

n=0
for f in "$ROOT"/supabase/tests/[1-9]*; do
  n=$((n + 1))
  fresh_db "t$n"
  echo "test: $(basename "$f")"
  case "$f" in
    *.sql)
      "${PSQL[@]}" -o /dev/null -f "$f" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  /  /'
      [ "${PIPESTATUS[0]}" = "0" ] || { echo "FAILED: $(basename "$f")"; exit 1; }
      ;;
    *.sh) source "$f" ;;
  esac
done
echo "database tests passed"
