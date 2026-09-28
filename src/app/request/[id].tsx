import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { PaymentError } from '@/services/payments';
import { useApp } from '@/store/app-store';
import { useAuthorize } from '@/store/authorize';
import { haptics } from '@/utils/haptics';
import { formatShort } from '@/utils/money';

export default function RequestReceived() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, userById, payRequest, declineRequest } = useApp();
  const authorize = useAuthorize();
  const [busy, setBusy] = useState<'pay' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const req = transactions.find((t) => t.id === id);
  const requester = req ? userById(req.toUser) : undefined;
  if (!req || !requester) return <Screen back="close">{null}</Screen>;

  const first = requester.name.split(' ')[0];
  const amount = formatShort(req.amountCents);
  const open = req.status === 'pending';

  const pay = async () => {
    setError(null);
    if (!(await authorize(`Pay ${amount} to ${requester.name}`))) return;
    setBusy('pay');
    try {
      await payRequest(req.id);
      router.replace({ pathname: '/success', params: { id: req.id } });
    } catch (e) {
      haptics.error();
      setError(e instanceof PaymentError ? e.message : 'Something went wrong. Nothing was sent.');
      setBusy(null);
    }
  };

  const decline = async () => {
    setBusy('decline');
    await declineRequest(req.id);
    router.back();
  };

  return (
    <Screen
      back="close"
      footer={
        open ? (
          <>
            {error ? (
              <Text variant="small" color="error" align="center">
                {error}
              </Text>
            ) : null}
            <Button label="Pay" icon="faceId" loading={busy === 'pay'} disabled={!!busy} onPress={pay} />
            <Button label="Decline" variant="secondary" loading={busy === 'decline'} disabled={!!busy} onPress={decline} />
          </>
        ) : (
          <Button label="Close" variant="secondary" onPress={() => router.back()} />
        )
      }>
      <View style={styles.center}>
        <Avatar name={requester.name} uri={requester.avatarUrl} size={112} ring />
        <Text color="textSecondary">@{requester.handle}</Text>
        <Text variant="display" align="center" style={styles.q}>
          {first} is requesting {amount}
        </Text>
        {req.note ? (
          <Text variant="heading" color="textSecondary" align="center">
            {req.note}
          </Text>
        ) : null}
        {!open ? (
          <Text color="textSecondary">{req.status === 'completed' ? 'You paid this request.' : 'You declined this request.'}</Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  q: { marginTop: 18 },
});
