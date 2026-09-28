import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Transaction } from '@/data/types';
import { describe, useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { shortTime } from '@/utils/dates';
import { formatCents } from '@/utils/money';

import { Avatar } from './avatar';
import { Text } from './text';

export function statusLine(tx: Transaction, meId: string, otherFirst: string) {
  const d = describe(tx, meId);
  if (!d.isRequest) return tx.note || (d.outgoing ? 'Sent' : 'Received');
  if (tx.status === 'pending') return d.outgoing ? `Requested · ${tx.note}` : `You requested · ${tx.note}`;
  if (tx.status === 'declined') return d.outgoing ? `You declined · ${tx.note}` : `${otherFirst} declined · ${tx.note}`;
  return tx.note;
}

export function TransactionRow({ tx }: { tx: Transaction }) {
  const { me, userById } = useApp();
  const { colors } = useTheme();
  const d = describe(tx, me.id);
  const other = userById(d.otherId);
  const name = other?.name ?? 'Unknown';

  const sign = d.received ? '+' : d.sent ? '−' : '';
  const amountColor = d.received ? 'successText' : tx.status === 'declined' ? 'textSecondary' : 'text';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${statusLine(tx, me.id, name.split(' ')[0])}, ${sign === '+' ? 'received' : sign ? 'sent' : ''} ${formatCents(tx.amountCents)}, ${shortTime(tx.createdAt)}`}
      onPress={() =>
        d.needsMyAction
          ? router.push({ pathname: '/request/[id]', params: { id: tx.id } })
          : router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
      }
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <Avatar name={name} uri={other?.avatarUrl} size={48} />
      <View style={styles.middle}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="small" color={d.needsMyAction ? 'accent' : 'textSecondary'} numberOfLines={1}>
          {statusLine(tx, me.id, name.split(' ')[0])}
        </Text>
      </View>
      <View style={styles.right}>
        <Text
          variant="amount"
          color={amountColor}
          style={tx.status === 'declined' ? { textDecorationLine: 'line-through', textDecorationColor: colors.textSecondary } : undefined}>
          {sign}
          {formatCents(tx.amountCents)}
        </Text>
        <Text variant="caption" color="textSecondary">
          {shortTime(tx.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68, paddingVertical: 8 },
  middle: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
});
