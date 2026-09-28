import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Keypad } from '@/components/keypad';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { PaymentError, TEST_FUNDING_SOURCES } from '@/services/payments';
import { useApp } from '@/store/app-store';
import { useAuthorize } from '@/store/authorize';
import { Type } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { applyKey, displayTyped, formatShort, toCents } from '@/utils/money';

export default function WalletAction() {
  const { action } = useLocalSearchParams<{ action: 'add' | 'cashout' }>();
  const add = action !== 'cashout';
  const { addMoney, cashOut, balanceCents } = useApp();
  const authorize = useAuthorize();
  const [amount, setAmount] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = toCents(amount);
  const source = add ? TEST_FUNDING_SOURCES[0] : TEST_FUNDING_SOURCES[1];

  const go = async () => {
    setError(null);
    if (!add && !(await authorize(`Cash out ${formatShort(cents)}`))) return;
    setBusy(true);
    try {
      await (add ? addMoney(cents) : cashOut(cents));
      haptics.success();
      router.back();
    } catch (e) {
      setError(e instanceof PaymentError ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <Screen
      back="close"
      title={add ? 'Add money' : 'Cash out'}
      footer={
        <>
          <Keypad onKey={(k) => setAmount((a) => applyKey(a, k))} />
          <Button label={add ? 'Add test money' : 'Cash out'} disabled={cents === 0} loading={busy} onPress={go} />
        </>
      }>
      <View style={styles.center}>
        <Text style={[Type.hero, { fontSize: 72, lineHeight: 80 }]} color={cents ? 'text' : 'textSecondary'} adjustsFontSizeToFit numberOfLines={1}>
          {displayTyped(amount)}
        </Text>
        <Text variant="small" color={error ? 'error' : 'textSecondary'} align="center">
          {error ?? (add ? `From ${source.label}` : `To ${source.label} · Balance ${formatShort(balanceCents)}`)}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 } });
