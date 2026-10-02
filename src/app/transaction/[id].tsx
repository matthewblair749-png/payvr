import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card, ListRow, SectionLabel } from '@/components/list-row';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { canRemind, remindRequest } from '@/services/requests';
import { describe, useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { fullDateTime } from '@/utils/dates';
import { haptics } from '@/utils/haptics';
import { formatCents } from '@/utils/money';

const STATUS = { pending: 'Pending', completed: 'Completed', declined: 'Declined' } as const;

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { transactions, userById, me } = useApp();
  const [reminded, setReminded] = useState<'idle' | 'sending' | 'sent' | 'error'>(() => (id && !canRemind(id) ? 'sent' : 'idle'));
  const tx = transactions.find((t) => t.id === id);
  if (!tx) {
    return (
      <Screen back="back" title="Details">
        <Text color="textSecondary" align="center" style={styles.missing}>
          We couldn’t find this payment. It may have been removed, or it belongs to another account.
        </Text>
      </Screen>
    );
  }

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

  // A request I sent that hasn't been paid yet.
  const myOpenRequest = d.isRequest && !d.outgoing && tx.status === 'pending';
  const remind = async () => {
    setReminded('sending');
    try {
      await remindRequest(tx.id);
      haptics.success();
      setReminded('sent');
    } catch {
      setReminded('error');
    }
  };

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

      {d.needsMyAction ? (
        <View style={styles.actions}>
          <Button label={`Review and pay ${formatCents(tx.amountCents)}`} onPress={() => router.push({ pathname: '/request/[id]', params: { id: tx.id } })} />
        </View>
      ) : null}
      {myOpenRequest ? (
        <View style={styles.actions}>
          <Button
            label={reminded === 'sent' ? 'Reminder sent' : `Remind ${other?.name.split(' ')[0] ?? 'them'}`}
            icon={reminded === 'sent' ? 'check' : 'bell'}
            variant="secondary"
            loading={reminded === 'sending'}
            disabled={reminded === 'sent'}
            onPress={remind}
          />
          <Text variant="caption" color={reminded === 'error' ? 'error' : 'textSecondary'} align="center">
            {reminded === 'error'
              ? 'Couldn’t send the reminder. Check your connection and try again.'
              : reminded === 'sent'
                ? 'We sent a gentle nudge. You can remind again tomorrow.'
                : 'Sends them a notification. You can remind once a day.'}
          </Text>
        </View>
      ) : null}

      <SectionLabel>Receipt</SectionLabel>
      <Card>
        <ListRow label="Status" value={STATUS[tx.status]} />
        <ListRow label="Date" value={fullDateTime(tx.createdAt)} />
        {tx.completedAt && tx.completedAt !== tx.createdAt ? <ListRow label="Completed" value={fullDateTime(tx.completedAt)} /> : null}
        <ListRow label="Type" value={tx.type === 'send' ? 'Payment' : 'Request'} />
        <ListRow label="Amount" value={formatCents(tx.amountCents)} />
        <ListRow label="Fee" value="Free" />
        <ListRow label="Transaction ID" value={tx.id.slice(0, 8).toUpperCase()} last />
      </Card>
      <Text variant="caption" color="textSecondary" align="center" selectable style={styles.test}>
        Full ID: {tx.id}
      </Text>

      <SectionLabel>Need help?</SectionLabel>
      <Card>
        {d.sent ? (
          <ListRow
            icon="shield"
            label="Dispute this payment"
            onPress={() => router.push({ pathname: '/support/dispute', params: { id: tx.id } })}
          />
        ) : null}
        <ListRow icon="help" label="Report a problem" onPress={() => router.push({ pathname: '/support/report', params: { id: tx.id } })} last />
      </Card>
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
  missing: { marginTop: 64, paddingHorizontal: 12 },
  actions: { gap: 10, marginBottom: 8 },
});
