import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useApp } from '@/store/app-store';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { StepHeader } from '@/components/step-header';
import { Text } from '@/components/text';
import { signupDraft } from '@/store/signup-draft';

function formatUS(digits: string) {
  const d = digits.slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function PhoneStep() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const login = mode === 'login';
  const { sendCode, backendMode } = useApp();
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = digits.length === 10;

  const submit = async () => {
    signupDraft.mode = login ? 'login' : 'signup';
    signupDraft.phone = `+1 ${formatUS(digits)}`;
    signupDraft.phoneE164 = `+1${digits}`;
    setBusy(true);
    setError(null);
    try {
      await sendCode(signupDraft.phoneE164);
      router.push('/code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send a code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      back="back"
      footer={
        <>
          <Text variant="small" color="textSecondary" align="center">
            {backendMode === 'mock' ? 'We’ll text you a 6-digit code. Prototype: any code works.' : 'We’ll text you a 6-digit code.'}
          </Text>
          <Button
            label="Send code"
            disabled={!valid}
            loading={busy}
            onPress={submit}
          />
        </>
      }>
      <StepHeader
        step={login ? undefined : 1}
        total={login ? undefined : 6}
        title={login ? 'Welcome back' : 'What’s your number?'}
        subtitle={login ? 'Log in with your phone number.' : 'Your phone number is your Payvr account.'}
      />
      <Field
        label="Phone number"
        prefix="+1"
        autoFocus
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        placeholder="(415) 555-0142"
        value={formatUS(digits)}
        onChangeText={(t) => setDigits(t.replace(/\D/g, '').slice(0, 10))}
        error={error}
      />
    </Screen>
  );
}
