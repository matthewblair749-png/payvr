import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Transaction } from '@/data/types';
import { describe, useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { shortTime } from '@/utils/dates';
import { formatCents } from '@/utils/money';
import { listEnter, listLayout } from '@/utils/motion';

import { Avatar, type AvatarBadge } from './avatar';
import { PressableScale } from './pressable-scale';
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
  const first = name.split(' ')[0];

  const sign = d.received ? '+' : d.sent ? '−' : '';
  const amountColor = d.received ? 'successText' : tx.status === 'declined' ? 'textSecondary' : 'text';

  const badge: AvatarBadge = d.isRequest
    ? { icon: 'request', color: tx.status === 'declined' ? colors.textSecondary : colors.accent, label: 'Request' }
    : d.received
      ? { icon: 'arrowDownLeft', color: colors.success, label: 'Received' }
      : { icon: 'arrowUpRight', color: colors.text, label: 'Sent' };

  const open = () =>
    d.needsMyAction
      ? router.push({ pathname: '/request/[id]', params: { id: tx.id } })
      : router.push({ pathname: '/transaction/[id]', params: { id: tx.id } });

  const chip = d.needsMyAction
    ? null
    : d.isRequest && tx.status === 'pending'
      ? 'Waiting'
      : tx.status === 'declined'
        ? 'Declined'
        : null;

  return (
    <Animated.View entering={listEnter()} layout={listLayout}>
      <PressableScale
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${statusLine(tx, me.id, first)}, ${sign === '+' ? 'received' : sign ? 'sent' : ''} ${formatCents(tx.amountCents)}, ${shortTime(tx.createdAt)}`}
        onPress={open}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}>
        <Avatar name={name} uri={other?.avatarUrl} size={46} badge={badge} />
        <View style={styles.middle}>
          <Text variant="bodyMedium" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="small" color="textSecondary" numberOfLines={1}>
            {statusLine(tx, me.id, first)} · {shortTime(tx.createdAt)}
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
          {d.needsMyAction ? (
            <View style={[styles.payPill, { backgroundColor: colors.primary }]}>
              <Text variant="caption" style={{ color: colors.onPrimary }}>
                Pay
              </Text>
            </View>
          ) : chip ? (
            <View style={[styles.chip, { borderColor: colors.border }]}>
              <Text variant="caption" color="textSecondary">
                {chip}
              </Text>
            </View>
          ) : null}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68, paddingVertical: 10 },
  middle: { flex: 1, gap: 2, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 4 },
  payPill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 3 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, borderWidth: StyleSheet.hairlineWidth },
});
