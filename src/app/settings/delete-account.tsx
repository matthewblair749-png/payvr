import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Icon } from '@/components/icon';
import { SectionLabel } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Footnote, Section, SettingsHero } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { deleteAccount, shareDataExport } from '@/services/account';
import { resetAccountForSignup } from '@/store/account';
import { useApp } from '@/store/app-store';
import { useAuthorize } from '@/store/authorize';
import { useTheme } from '@/theme/theme-provider';
import { formatCents } from '@/utils/money';

const CONFIRM_WORD = 'DELETE';

export default function DeleteAccount() {
  const { colors } = useTheme();
  const { me, balanceCents, transactions, contacts, settings, signOut } = useApp();
  const authorize = useAuthorize();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRequests = transactions.filter((t) => t.type === 'request' && t.status === 'pending').length;
  const hasBalance = balanceCents > 0;

  const exportData = async () => {
    setBusy('export');
    setError(null);
    try {
      await shareDataExport({ exportedAt: new Date().toISOString(), profile: me, transactions, contacts, settings });
      setExported(true);
    } catch {
      setError('Couldn’t create your data export. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!(await authorize('Confirm it’s you to delete your account'))) return;
    setBusy('delete');
    setError(null);
    try {
      await deleteAccount();
      resetAccountForSignup();
      await signOut();
      router.replace('/onboarding');
    } catch {
      setError('Couldn’t delete your account right now. Nothing was removed. Try again, or contact support.');
      setBusy(null);
    }
  };

  return (
    <Screen
      back="back"
      scroll
      footer={
        <Button
          label="Delete my account"
          variant="danger"
          disabled={hasBalance || typed.trim().toUpperCase() !== CONFIRM_WORD || busy !== null}
          loading={busy === 'delete'}
          onPress={remove}
        />
      }>
      <SettingsHero icon="logout" title="Delete account" body="This closes your Payvr account for good. It can’t be undone." />

      <Section index={1}>
        <SectionLabel>1. Download your data</SectionLabel>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text color="textSecondary">Your profile, payments, contacts and settings, as a file you can keep.</Text>
          <Button
            label={exported ? 'Download again' : 'Download my data'}
            icon={exported ? 'check' : 'arrowDown'}
            variant="secondary"
            size="md"
            loading={busy === 'export'}
            onPress={exportData}
          />
        </View>
      </Section>

      <Section index={2}>
        <SectionLabel>2. Before you go</SectionLabel>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: hasBalance ? colors.error : colors.border }]}>
          <Check ok={!hasBalance} text={hasBalance ? `Cash out your ${formatCents(balanceCents)} balance first` : 'Your balance is $0.00'} />
          {hasBalance ? (
            <Button label="Cash out" variant="secondary" size="md" onPress={() => router.push({ pathname: '/money/[action]', params: { action: 'cashout' } })} />
          ) : null}
          <Check
            ok={pendingRequests === 0}
            info
            text={pendingRequests ? `${pendingRequests} open request${pendingRequests === 1 ? '' : 's'} will be cancelled` : 'No open requests'}
          />
        </View>
        <Footnote>
          Deleting removes your profile, @handle and sign-in. We keep records of past payments only as long as financial
          regulations require, then delete them.
        </Footnote>
      </Section>

      <Section index={3}>
        <SectionLabel>3. Confirm</SectionLabel>
        <Field
          label={`Type ${CONFIRM_WORD} to confirm`}
          autoCapitalize="characters"
          autoCorrect={false}
          value={typed}
          onChangeText={setTyped}
        />
        {error ? <Footnote tone="error">{error}</Footnote> : null}
      </Section>
    </Screen>
  );
}

/** A pre-flight line: a check when fine, a cross when it blocks deleting, a note when it only informs. */
function Check({ ok, text, info }: { ok: boolean; text: string; info?: boolean }) {
  const { colors } = useTheme();
  const icon = ok ? 'check' : info ? 'help' : 'close';
  const color = ok ? colors.success : info ? colors.textSecondary : colors.error;
  return (
    <View style={styles.check}>
      <Icon name={icon} size={16} color={color} strokeWidth={ok || !info ? 3 : 2} />
      <Text variant="small" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: 20, borderWidth: 1 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
});
