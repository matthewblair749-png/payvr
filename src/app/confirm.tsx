import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { PaymentError } from '@/services/payments';
import { useApp } from '@/store/app-store';
import { useAuthorize } from '@/store/authorize';
import { haptics } from '@/utils/haptics';
import { formatShort } from '@/utils/money';

export default function Confirm() {
  const { draft, userById, submitDraft } = useApp();
  const authorize = useAuthorize();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peer = draft?.peerId ? userById(draft.peerId) : undefined;
  if (!draft || !peer) return <Screen back="back">{null}</Screen>;

  const first = peer.name.split(' ')[0];
  const amount = formatShort(draft.amountCents);
  const isSend = draft.mode === 'send';
  const fromQrRequest = draft.origin === 'qrRequest';
  const question = fromQrRequest
    ? `Pay ${amount} to ${first}?`
    : isSend
      ? `Send ${amount} to ${first}?`
      : `Request ${amount} from ${first}?`;

  const go = async () => {
    setError(null);
    if (isSend) {
      const ok = await authorize(`Send ${amount} to ${peer.name}`);
      if (!ok) return;
    }
    setBusy(true);
    try {
      const tx = await submitDraft();
      router.replace({ pathname: '/success', params: { id: tx.id } });
    } catch (e) {
      haptics.error();
      setError(e instanceof PaymentError ? e.message : 'Something went wrong. Nothing was sent.');
      setBusy(false);
    }
  };

  return (
    <Screen
      back="back"
      footer={
        <>
          {error ? (
            <Text variant="small" color="error" align="center" accessibilityLiveRegion="assertive">
              {error}
            </Text>
          ) : null}
          <Button
            label={fromQrRequest ? 'Pay' : isSend ? 'Send' : 'Request'}
            icon={isSend ? 'faceId' : undefined}
            loading={busy}
            onPress={go}
            accessibilityHint={isSend ? 'Asks for Face ID or your PIN, then sends the money' : undefined}
          />
        </>
      }>
      <Animated.View entering={FadeInUp.duration(300)} style={styles.center}>
        {fromQrRequest ? (
          <Text variant="caption" color="accent" style={styles.badge}>
            {first.toUpperCase()} IS REQUESTING
          </Text>
        ) : null}
        <Avatar name={peer.name} uri={peer.avatarUrl} size={120} ring />
        <View style={styles.who}>
          <Text variant="heading" align="center">
            {peer.name}
          </Text>
          <Text color="textSecondary" align="center">
            @{peer.handle}
          </Text>
        </View>
        <Text variant="display" align="center" style={styles.question}>
          {question}
        </Text>
        {draft.note ? (
          <Text variant="bodyMedium" color="textSecondary" align="center">
            {draft.note}
          </Text>
        ) : null}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  who: { gap: 2 },
  question: { marginTop: 16 },
  badge: { letterSpacing: 0.8 },
});
