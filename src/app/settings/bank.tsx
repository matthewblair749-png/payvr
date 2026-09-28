import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Card, ListRow, SectionLabel } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import {
  getPayoutAccount,
  setupPayoutAccount,
  STRIPE_MODE,
  TEST_FUNDING_SOURCES,
  type PayoutAccount,
} from '@/services/payments';
import { useTheme } from '@/theme/theme-provider';

const STATE_LABEL: Record<PayoutAccount['state'], string> = {
  not_started: 'Not set up',
  incomplete: 'Needs details',
  ready: 'Ready',
};

export default function Bank() {
  return STRIPE_MODE ? <StripeBank /> : <TestBank />;
}

function StripeBank() {
  const { colors } = useTheme();
  const [account, setAccount] = useState<PayoutAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPayoutAccount()
      .then(setAccount)
      .catch(() => setError('Couldn’t reach Stripe.'));
  }, []);

  const setup = async () => {
    setBusy(true);
    setError(null);
    try {
      setAccount(await setupPayoutAccount());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t open Stripe.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      back="back"
      title="Bank & card"
      footer={
        account && account.state !== 'ready' ? (
          <Button label={account.state === 'not_started' ? 'Set up cash out with Stripe' : 'Finish Stripe setup'} loading={busy} onPress={setup} />
        ) : undefined
      }>
      <SectionLabel>Add money</SectionLabel>
      <Card>
        <ListRow icon="lock" label="Card" value="Entered in Stripe’s checkout" last />
      </Card>
      <Text variant="small" color="textSecondary" style={styles.note}>
        Card details go straight to Stripe. Payvr never sees or stores card numbers.
      </Text>

      <SectionLabel>Cash out</SectionLabel>
      <Card>
        {account ? (
          <ListRow icon="bank" label={account.bank ?? 'Stripe account'} value={STATE_LABEL[account.state]} last />
        ) : error ? (
          <ListRow icon="bank" label="Stripe account" value="Unavailable" last />
        ) : (
          <ActivityIndicator style={styles.loading} color={colors.accent} />
        )}
      </Card>
      <Text variant="small" color={error ? 'error' : 'textSecondary'} style={styles.note}>
        {error ?? 'Cash-outs go to your own Stripe account (Stripe Connect), then to your bank. Stripe test mode: no real money.'}
      </Text>
    </Screen>
  );
}

function TestBank() {
  return (
    <Screen back="back" title="Bank & card" footer={<Button label="Link another (test)" variant="secondary" icon="plus" disabled />}>
      <Card style={styles.card}>
        {TEST_FUNDING_SOURCES.map((s, i) => (
          <ListRow
            key={s.id}
            icon={s.kind === 'bank' ? 'bank' : 'lock'}
            label={s.label}
            value={s.kind === 'bank' ? 'Cash out' : 'Add money'}
            last={i === TEST_FUNDING_SOURCES.length - 1}
          />
        ))}
      </Card>
      <Text variant="small" color="textSecondary" style={styles.note}>
        Stripe isn’t connected, so these are pretend test accounts. Add a Stripe test key to use Stripe (see docs/STRIPE.md).
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12 },
  note: { marginTop: 10, marginLeft: 4 },
  loading: { paddingVertical: 18 },
});
