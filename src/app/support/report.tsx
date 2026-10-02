import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { SectionLabel } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { ChoiceCard, Footnote, SettingsHero } from '@/components/settings-ui';
import { TicketDone } from '@/components/ticket-done';
import type { IconName } from '@/components/icon';
import { submitReport, type ReportTopic } from '@/services/support';

const TOPICS: { value: ReportTopic; label: string; hint: string; icon: IconName }[] = [
  { value: 'missing_payment', label: 'Money didn’t arrive', hint: 'A payment or request is stuck or missing', icon: 'arrowDownLeft' },
  { value: 'wrong_person', label: 'Paid the wrong person', hint: 'Sent to someone by mistake', icon: 'users' },
  { value: 'add_or_cash_out', label: 'Adding money or cashing out', hint: 'Bank or card transfers', icon: 'bank' },
  { value: 'account', label: 'My account or login', hint: 'Sign-in codes, verification, security', icon: 'lock' },
  { value: 'app_problem', label: 'Something isn’t working', hint: 'A screen, button or tap that misbehaves', icon: 'bolt' },
  { value: 'other', label: 'Something else', hint: 'Tell us in your own words', icon: 'help' },
];

export default function ReportProblem() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [topic, setTopic] = useState<ReportTopic | null>(id ? 'missing_payment' : null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);

  const send = async () => {
    if (!topic) return;
    setBusy(true);
    setError(null);
    try {
      const t = await submitReport({ topic, details: details.trim(), transactionId: id });
      setTicket(t.id);
    } catch {
      setError('Couldn’t send your report. Check your connection and try again. Nothing was lost.');
    } finally {
      setBusy(false);
    }
  };

  if (ticket) {
    return (
      <Screen back="close">
        <TicketDone ticket={ticket} title="Thanks, we’re on it" body="Our support team usually replies within one business day. We’ll send you a notification." />
      </Screen>
    );
  }

  return (
    <Screen
      back="close"
      scroll
      footer={<Button label="Send report" disabled={!topic || details.trim().length < 10} loading={busy} onPress={send} />}>
      <SettingsHero icon="help" title="Report a problem" body="Tell us what happened and we’ll help sort it out." />
      <SectionLabel>What’s it about?</SectionLabel>
      <View style={styles.choices}>
        {TOPICS.map((t) => (
          <ChoiceCard key={t.value} icon={t.icon} label={t.label} hint={t.hint} selected={topic === t.value} onPress={() => setTopic(t.value)} />
        ))}
      </View>
      <SectionLabel>What happened?</SectionLabel>
      <Field
        placeholder="A few sentences help us fix it faster"
        multiline
        maxLength={2000}
        value={details}
        onChangeText={setDetails}
        accessibilityLabel="What happened"
        style={styles.details}
      />
      {id ? <Footnote>We’ll attach this payment ({id.slice(0, 8).toUpperCase()}) so you don’t have to look it up.</Footnote> : null}
      {error ? <Footnote tone="error">{error}</Footnote> : null}
      <Footnote>Never share your PIN or SMS codes. Payvr support will never ask for them.</Footnote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  choices: { gap: 8 },
  details: { minHeight: 120, textAlignVertical: 'top', paddingTop: 14 },
});
