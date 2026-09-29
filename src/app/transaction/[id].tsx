import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Card, ListRow } from '@/components/list-row';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { describe, useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { fullDateTime } from '@/utils/dates';
import { formatCents } from '@/utils/money';

const STATUS = { pending: 'Pending', completed: 'Completed', declined: 'Declined' } as const;

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { transactions, userById, me } = useApp();
  const tx = transactions.find((t) => t.id === id);
  if (!tx) return <Screen back="back">{null}</Screen>;

  const d = describe(tx, me.id);
  const other = userById(d.otherId);
  const sign = d.received ? '+' : d.sent ? '−' : '';
  const kind = d.isRequest
    ? d.outgoing
      ? `Request from ${other?.name.split(' ')[0]}`
      : `Request to ${other?.name.split(' ')[0]}`
    : d.outgoing
      ? 'Sent'
      : 'Received';

  return (
    <Screen back="back" title="Details" scroll>
      <View style={styles.head}>
        <Text variant="caption" color="textSecondary">
          {kind}
        </Text>
        <Text variant="hero" color={d.received ? 'success' : 'text'} adjustsFontSizeToFit numberOfLines={1}>
          {sign}
          {formatCents(tx.amountCents)}
        </Text>
        {tx.note ? <Text variant="bodyMedium" color="textSecondary">{tx.note}</Text> : null}
      </View>

      {other ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Open ${other.name}'s profile`}
          onPress={() => router.push({ pathname: '/person/[id]', params: { id: other.id } })}
          style={[styles.person, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Avatar name={other.name} uri={other.avatarUrl} size={48} />
          <View style={styles.flex}>
            <Text variant="bodyMedium">{other.name}</Text>
            <Text variant="small" color="textSecondary">
              @{other.handle}
            </Text>
          </View>
          <Text variant="bodyMedium" color="accent">
            View
          </Text>
        </PressableScale>
      ) : null}

      <Card>
        <ListRow label="Status" value={STATUS[tx.status]} />
        <ListRow label="Date" value={fullDateTime(tx.createdAt)} />
        <ListRow label="Type" value={tx.type === 'send' ? 'Payment' : 'Request'} />
        <ListRow label="Transaction ID" value={tx.id.slice(0, 8).toUpperCase()} last />
      </Card>
      <Text variant="caption" color="textSecondary" align="center" selectable style={styles.test}>
        {tx.id}
      </Text>
      <Text variant="caption" color="textSecondary" align="center" style={styles.test}>
        Test transaction · no real money moved
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 4, marginVertical: 24 },
  flex: { flex: 1 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  test: { marginTop: 16 },
});
