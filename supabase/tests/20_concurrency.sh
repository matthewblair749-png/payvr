#!/usr/bin/env bash
# Double-spend check: 10 simultaneous $100 payments from a $500 wallet.
# Exactly 5 may succeed and the balance must end at $0. Called by scripts/test-db.sh with PSQL set.
set -euo pipefail
D=00000000-0000-0000-0000-0000000000d1
E=00000000-0000-0000-0000-0000000000e1
"${PSQL[@]}" -o /dev/null -c "
  insert into auth.users (id, phone) values ('$D', '1'), ('$E', '2');
  insert into public.users (id, name, handle) values ('$D', 'Dee Racer', 'dee'), ('$E', 'Eve Target', 'eve');"

OUT="$(mktemp)"
chmod 666 "$OUT"
for i in $(seq 1 10); do
  ( "${PSQL[@]}" -t -A -c "set role authenticated;
      select set_config('request.jwt.claims', '{\"sub\":\"$D\"}', false);
      select public.send_payment('$E', 10000, 'race $i');" >/dev/null 2>&1 \
    && echo ok >> "$OUT" || echo fail >> "$OUT" ) &
done
wait
OKS=$(grep -c ok "$OUT" || true)
BAL=$("${PSQL[@]}" -t -A -c "select balance_cents from public.wallets where user_id = '$D'")
rm -f "$OUT"
if [ "$OKS" = "5" ] && [ "$BAL" = "0" ]; then
  echo "  ok - 10 parallel \$100 sends from \$500: exactly 5 succeed, balance \$0"
else
  echo "FAIL: parallel sends: $OKS succeeded, balance $BAL"; exit 1
fi
