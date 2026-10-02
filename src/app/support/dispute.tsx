import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import type { IconName } from '@/components/icon';
import { SectionLabel } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { ChoiceCard, Footnote, SettingsHero } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { TicketDone } from '@/components/ticket-done';
import { submitDispute, type DisputeReason } from '@/services/support';
import { describe, useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { fullDateTime } from '@/utils/dates';
import { formatCents } from '@/utils/money';

const REASONS: { value: DisputeReason; label: string; hint: string; icon: IconName }[] = [
  { value: 'unauthorized', label: 'I didn’t make this payment', hint: 'Someone else used my account', icon: 'lock' },
  { value: 'wrong_amount', label: 'Wrong amount', hint: 'I was charged more than I agreed', icon: 'request' },
  { value: 'duplicate', label: 'Paid twice', hint: 'The same payment went through more than once', icon: 'card' },
  { value: 'wrong_person', label: 'Sent to the wrong person', hint: 'They haven’t sent it back', icon: 'users' },
  { value: 'not_received', label: 'Didn’t get what I paid for', hint: 'Goods or a service never arrived', icon: 'help' },
];

/** File a dispute on a payment you sent. */
export default function DisputePayment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { transactions, userById, me } = useApp();
  const tx = transactions.find((t) => t.id === id);
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);

  if (!tx || !describe(tx, me.id).sent) {
    return (
      <Screen back="close" title="Dispute">
        <Text color="textSecondary" align="center" style={styles.missing}>
          You can dispute payments you sent once they’ve completed. Open the payment from Activity and choose “Dispute this
          payment”.
        </Text>
      </Screen>
    );
  }
  const other = userById(tx.toUser);

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      const t = await submitDispute({ transactionId: tx.id, reason, details: details.trim() });
      setTicket(t.id);
    } catch {
      setError('Couldn’t file the dispute. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (ticket) {
    return (
      <Screen back="close">
        <TicketDone
          ticket={ticket}
          title="Dispute filed"
          body="We’ll review it and may contact the other person. You’ll hear from us within 10 business days, and we’ll notify you of any update."
        />
      </Screen>
    );
  }

  return (
    <Screen
      back="close"
      scroll
      footer={<Button label="File dispute" disabled={!reason || details.trim().length < 10} loading={busy} onPress={send} />}>
      <SettingsHero icon="shield" title="Dispute a payment" body="Tell us what went wrong with this payment." />

      <View style={[styles.payment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Avatar name={other?.name ?? '?'} uri={other?.avatarUrl} size={44} />
        <View style={styles.flex}>
          <Text variant="bodyMedium">To {other?.name ?? 'Unknown'}</Text>
          <Text variant="small" color="textSecondary" numberOfLines={1}>
            {tx.note ? `${tx.note} · ` : ''}
            {fullDateTime(tx.completedAt ?? tx.createdAt)}
          </Text>
        </View>
        <Text variant="amount">{formatCents(tx.amountCents)}</Text>
      </View>

      <SectionLabel>What went wrong?</SectionLabel>
      <View style={styles.choices}>
        {REASONS.map((r) => (
          <ChoiceCard key={r.value} icon={r.icon} label={r.label} hint={r.hint} selected={reason === r.value} onPress={() => setReason(r.value)} />
        ))}
      </View>
      {reason === 'unauthorized' ? (
        <View style={[styles.urgent, { borderColor: colors.error }]}>
          <Text variant="bodyMedium">Secure your account now</Text>
          <Text variant="small" color="textSecondary">
            If someone else may have used your phone or PIN, change your PIN right away. We’ll also review recent activity.
          </Text>
          <Button label="Change PIN" variant="secondary" size="md" onPress={() => router.push('/settings/security')} />
        </View>
      ) : null}

      <SectionLabel>Details</SectionLabel>
      <Field
        placeholder="What happened, and what you’ve tried so far"
        multiline
        maxLength={2000}
        value={details}
        onChangeText={setDetails}
        accessibilityLabel="Dispute details"
        style={styles.details}
      />
      {error ? <Footnote tone="error">{error}</Footnote> : null}
      <Footnote>
        Payvr is for paying people you know. Purchases from people you don’t know may not be eligible for a refund.
      </Footnote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  missing: { marginTop: 64, paddingHorizontal: 12 },
  payment: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, marginTop: 16 },
  choices: { gap: 8 },
  urgent: { gap: 8, padding: 16, borderRadius: 20, borderWidth: 1, marginTop: 12 },
  details: { minHeight: 120, textAlignVertical: 'top', paddingTop: 14 },
});
