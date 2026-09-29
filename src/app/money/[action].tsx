import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Keypad } from '@/components/keypad';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import {
  PaymentError,
  setupPayoutAccount,
  STRIPE_MODE,
  TEST_FUNDING_SOURCES,
  type PayoutAccount,
} from '@/services/payments';
import { useApp } from '@/store/app-store';
import { useAuthorize } from '@/store/authorize';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP, Type } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { applyKey, displayTyped, formatCents, formatShort, toCents } from '@/utils/money';

type Speed = 'instant' | 'standard';
/** Instant cash-out fee shown for realism; nothing is charged in test mode. */
const INSTANT_FEE_RATE = 0.015;
const instantFee = (cents: number) => (cents > 0 ? Math.max(25, Math.round(cents * INSTANT_FEE_RATE)) : 0);

export default function WalletAction() {
  const { action } = useLocalSearchParams<{ action: 'add' | 'cashout' }>();
  const add = action !== 'cashout';
  const { colors } = useTheme();
  const { addMoney, cashOut, balanceCents } = useApp();
  const authorize = useAuthorize();
  const [amount, setAmount] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [needsPayouts, setNeedsPayouts] = useState(false);
  const [payouts, setPayouts] = useState<PayoutAccount | null>(null);
  const [speed, setSpeed] = useState<Speed>('instant');
  const cents = toCents(amount);

  const source = STRIPE_MODE
    ? add
      ? 'Card · Stripe test mode'
      : payouts?.bank
        ? `${payouts.bank} · Stripe`
        : 'Your Stripe account'
    : (add ? TEST_FUNDING_SOURCES[0] : TEST_FUNDING_SOURCES[1]).label;

  const go = async () => {
    setError(null);
    setNote(null);
    if (!add && !(await authorize(`Cash out ${formatShort(cents)} · ${speed === 'instant' ? 'Instant' : 'Standard'}`))) return;
    setBusy(true);
    try {
      await (add ? addMoney(cents) : cashOut(cents));
      haptics.success();
      router.back();
    } catch (e) {
      const err = e instanceof PaymentError ? e : null;
      if (err?.code === 'cancelled') {
        // Closed Stripe's sheet: nothing happened, stay here.
      } else if (err?.code === 'topup_pending') {
        setNote(err.message);
        setTimeout(() => router.back(), 1800);
        return;
      } else if (err?.code === 'payouts_not_ready') {
        setNeedsPayouts(true);
      } else {
        setError(err?.message ?? 'Something went wrong.');
      }
      setBusy(false);
    }
  };

  const setup = async () => {
    setBusy(true);
    setError(null);
    try {
      const status = await setupPayoutAccount();
      setPayouts(status);
      if (status.state === 'ready') setNeedsPayouts(false);
      else setError('Stripe still needs a few details. Tap Set up again to finish.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open Stripe.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      back="close"
      title={add ? 'Add money' : 'Cash out'}
      footer={
        needsPayouts ? (
          <Button label="Set up cash out with Stripe" loading={busy} onPress={setup} />
        ) : (
          <>
            <Keypad onKey={(k) => setAmount((a) => applyKey(a, k))} />
            <Button
              label={add ? (STRIPE_MODE ? 'Pay with card' : 'Add test money') : 'Cash out'}
              disabled={cents === 0}
              loading={busy}
              onPress={go}
            />
          </>
        )
      }>
      <View style={styles.center}>
        {needsPayouts ? (
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="heading" align="center">
              Where should your money go?
            </Text>
            <Text color="textSecondary" align="center">
              Cash-outs are sent to your own Stripe account, then to your bank. Stripe asks for a few details once. In test
              mode you can use Stripe’s test data.
            </Text>
          </View>
        ) : (
          <>
            <Text
              style={[Type.hero, { fontSize: 72, lineHeight: 80 }]}
              color={cents ? 'text' : 'textSecondary'}
              adjustsFontSizeToFit
              numberOfLines={1}>
              {displayTyped(amount)}
            </Text>
            <Text variant="small" color="textSecondary" align="center">
              {add ? `From ${source}` : `To ${source} · Balance ${formatShort(balanceCents)}`}
            </Text>
            {!add ? <SpeedPicker value={speed} onChange={setSpeed} cents={cents} /> : null}
            {add && STRIPE_MODE ? (
              <Text variant="caption" color="textSecondary" align="center" style={styles.hint}>
                Test card: 4242 4242 4242 4242 · any future date · any CVC
              </Text>
            ) : null}
          </>
        )}
        {error || note ? (
          <Text variant="small" color={error ? 'error' : 'successText'} align="center" accessibilityLiveRegion="polite">
            {error ?? note}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function SpeedPicker({ value, onChange, cents }: { value: Speed; onChange: (s: Speed) => void; cents: number }) {
  const { colors } = useTheme();
  const options: { value: Speed; title: string; detail: string; price: string }[] = [
    {
      value: 'instant',
      title: 'Instant',
      detail: 'In minutes',
      price: cents ? formatCents(instantFee(cents)) : '1.5%',
    },
    { value: 'standard', title: 'Standard', detail: '1–3 business days', price: 'Free' },
  ];
  return (
    <View style={styles.speeds} accessibilityRole="radiogroup" accessibilityLabel="Cash-out speed">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            scaleTo={0.98}
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={`${o.title}, ${o.price}, ${o.detail}`}
            aria-checked={active}
            onPress={() => {
              haptics.tap();
              onChange(o.value);
            }}
            style={({ pressed }) => [
              styles.speed,
              {
                borderColor: active ? colors.accent : colors.border,
                backgroundColor: colors.surface,
              },
            ]}>
            <Icon name={o.value === 'instant' ? 'bolt' : 'bank'} size={20} color={active ? colors.accent : colors.textSecondary} />
            <View style={styles.flex}>
              <Text variant="bodyMedium">{o.title}</Text>
              <Text variant="caption" color="textSecondary">
                {o.detail}
              </Text>
            </View>
            <Text variant="amount" color={active ? 'accent' : 'text'}>
              {o.price}
            </Text>
          </PressableScale>
        );
      })}
      <Text variant="caption" color="textSecondary" align="center">
        Fees aren’t charged in test mode.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  flex: { flex: 1 },
  speeds: { alignSelf: 'stretch', gap: 8, marginTop: 14 },
  speed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: MIN_TAP + 16,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  hint: { marginTop: 6 },
  panel: { padding: 20, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, gap: 10, marginBottom: 8 },
});
