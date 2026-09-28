import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { CheckDraw } from '@/components/check-draw';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { describe, useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { fullDateTime } from '@/utils/dates';
import { formatCents, formatShort } from '@/utils/money';

export default function Success() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { transactions, userById, me, setDraft } = useApp();
  const tx = transactions.find((t) => t.id === id);

  useEffect(() => () => setDraft(null), [setDraft]);

  if (!tx) return <Screen>{null}</Screen>;
  const d = describe(tx, me.id);
  const other = userById(d.otherId);
  const name = other?.name ?? 'them';
  const first = name.split(' ')[0];
  const amount = formatShort(tx.amountCents);
  const pendingRequest = tx.type === 'request' && tx.status === 'pending';
  const headline = d.received
    ? `${first} paid you ${amount}`
    : pendingRequest
      ? `${amount} requested from ${first}`
      : tx.type === 'request'
        ? `${amount} paid to ${first}`
        : `${amount} sent to ${first}`;

  const done = () => {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/home');
  };

  const when = tx.completedAt ?? tx.createdAt;
  const time = new Date(when).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const rows: [string, string][] = [
    ['Amount', formatCents(tx.amountCents)],
    [d.received ? 'From' : pendingRequest ? 'Requested from' : 'To', other ? `${name} · @${other.handle}` : name],
    ...(tx.note ? ([['Note', tx.note]] as [string, string][]) : []),
    ['Date', fullDateTime(when)],
    ['Payment ID', `PV-${tx.id.replace(/[^a-zA-Z0-9]/g, '').slice(-10).toUpperCase()}`],
  ];

  return (
    <Screen footer={<Button label="Done" onPress={done} />}>
      <View style={styles.center}>
        <CheckDraw color={colors.success} size={132} />
        <Animated.View entering={FadeInUp.delay(450).duration(350)} style={styles.text}>
          <Text variant="display" align="center" accessibilityLiveRegion="polite">
            {headline}
          </Text>
          {pendingRequest ? (
            <Text color="textSecondary" align="center">
              We’ll let you know when {first} pays.
            </Text>
          ) : (
            <View style={styles.arrived} accessibilityLabel={`Arrived instantly at ${time}. Encrypted.`}>
              <Icon name="lock" size={16} color={colors.successText} />
              <Text variant="bodyMedium" color="successText">
                Arrived instantly · {time}
              </Text>
            </View>
          )}
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(650).duration(350)}
          style={[styles.receipt, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.receiptHead}>
            <Avatar name={name} uri={other?.avatarUrl} size={44} />
            <View style={styles.flex}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {name}
              </Text>
              <Text variant="small" color="textSecondary" numberOfLines={1}>
                {other ? `@${other.handle}` : ''}
              </Text>
            </View>
            <Text variant="amount" color={d.received ? 'successText' : 'text'}>
              {d.received ? '+' : d.sent ? '−' : ''}
              {formatCents(tx.amountCents)}
            </Text>
          </View>
          <View style={[styles.tear, { borderColor: colors.border }]} />
          {rows.map(([k, v]) => (
            <View key={k} style={styles.row}>
              <Text variant="small" color="textSecondary">
                {k}
              </Text>
              <Text variant="small" style={styles.value}>
                {v}
              </Text>
            </View>
          ))}
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 },
  text: { gap: 10, alignItems: 'center' },
  arrived: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1, minWidth: 0 },
  receipt: { alignSelf: 'stretch', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 8 },
  receiptHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tear: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, minHeight: 24, alignItems: 'center' },
  value: { flexShrink: 1, textAlign: 'right' },
});
