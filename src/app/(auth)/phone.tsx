import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

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
  const [digits, setDigits] = useState('');
  const valid = digits.length === 10;

  return (
    <Screen
      back="back"
      footer={
        <>
          <Text variant="small" color="textSecondary" align="center">
            We’ll text you a 6-digit code. Prototype: any code works.
          </Text>
          <Button
            label="Send code"
            disabled={!valid}
            onPress={() => {
              signupDraft.mode = login ? 'login' : 'signup';
              signupDraft.phone = `+1 ${formatUS(digits)}`;
              router.push('/code');
            }}
          />
        </>
      }>
      <StepHeader
        step={login ? undefined : 1}
        total={login ? undefined : 5}
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
      />
    </Screen>
  );
}
