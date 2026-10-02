import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ChoiceCard, Footnote } from '@/components/settings-ui';
import { StepHeader } from '@/components/step-header';
import { linkFundingSource } from '@/services/kyc';
import { setAccount } from '@/store/account';

type Kind = 'bank' | 'card';

/**
 * Link where money comes from and goes to. The partner's own secure screen collects the
 * account or card details; Payvr only keeps the partner's token for it.
 */
export default function LinkAccount() {
  const [kind, setKind] = useState<Kind>('bank');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = async () => {
    setBusy(true);
    setError(null);
    try {
      await linkFundingSource(kind);
      setAccount({ linked: kind });
      router.push('/security-setup');
    } catch {
      setError('Linking didn’t finish. Your details weren’t saved. Try again, or skip for now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      back="back"
      scroll
      footer={
        <>
          <Button label={kind === 'bank' ? 'Link bank account' : 'Add debit card'} loading={busy} onPress={link} />
          <Button label="Skip for now" variant="ghost" disabled={busy} onPress={() => router.push('/security-setup')} />
        </>
      }>
      <StepHeader step={5} total={6} title="Link a bank or card" subtitle="Use it to add money to Payvr and cash out to your bank." />
      <View style={styles.choices}>
        <ChoiceCard
          icon="bank"
          label="Bank account"
          hint="Free transfers · log in to your bank securely"
          selected={kind === 'bank'}
          onPress={() => setKind('bank')}
        />
        <ChoiceCard
          icon="card"
          label="Debit card"
          hint="Instant cash out · Visa or Mastercard debit"
          selected={kind === 'card'}
          onPress={() => setKind('card')}
        />
      </View>
      {error ? <Footnote tone="error">{error}</Footnote> : null}
      <Footnote>
        You’ll enter your details on our payments partner’s secure screen. Payvr never sees or stores your full card or account
        number.
      </Footnote>
      <Footnote>You can still receive money without linking, and link one later in Wallet.</Footnote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  choices: { gap: 10 },
});
