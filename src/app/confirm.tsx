import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { PaymentError } from '@/services/payments';
import { useApp } from '@/store/app-store';
import { useAuthorize } from '@/store/authorize';
import { useTheme } from '@/theme/theme-provider';
import { haptics } from '@/utils/haptics';
import { formatCents, formatShort } from '@/utils/money';

export default function Confirm() {
  const { colors } = useTheme();
  const { draft, userById, submitDraft, balanceCents } = useApp();
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

  const rows: [string, string][] = isSend
    ? [
        ['From', `Payvr balance · ${formatCents(balanceCents)}`],
        ['Arrives', 'Instantly'],
        ['Fee', 'Free'],
      ]
    : [
        ['From', `${peer.name}`],
        ['They’ll see', `${amount}${draft.note ? ` · ${draft.note}` : ''}`],
        ['Fee', 'Free'],
      ];

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
            label={fromQrRequest ? `Pay ${amount}` : isSend ? `Send ${amount}` : `Request ${amount}`}
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
        <Avatar name={peer.name} uri={peer.avatarUrl} size={104} ring />
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
            “{draft.note}”
          </Text>
        ) : null}

        <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {rows.map(([k, v], i) => (
            <View
              key={k}
              style={[styles.row, i < rows.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <Text variant="small" color="textSecondary">
                {k}
              </Text>
              <Text variant="bodyMedium" numberOfLines={1} style={styles.value}>
                {v}
              </Text>
            </View>
          ))}
        </View>
        {isSend ? (
          <View style={styles.trust}>
            <Icon name="shield" size={16} color={colors.textSecondary} />
            <Text variant="caption" color="textSecondary">
              Payments are instant. Only pay people you know.
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  who: { gap: 2 },
  question: { marginTop: 10 },
  badge: { letterSpacing: 0.8 },
  summary: { alignSelf: 'stretch', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, gap: 12 },
  value: { flexShrink: 1, textAlign: 'right' },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
});
