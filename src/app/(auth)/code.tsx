import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { StepHeader } from '@/components/step-header';
import { Text } from '@/components/text';
import { useApp } from '@/store/app-store';
import { signupDraft } from '@/store/signup-draft';
import { useTheme } from '@/theme/theme-provider';
import { Fonts } from '@/theme/typography';

const LEN = 6;

export default function CodeStep() {
  const { colors } = useTheme();
  const { logIn } = useApp();
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(30);
  const [busy, setBusy] = useState(false);
  const input = useRef<TextInput>(null);
  const login = signupDraft.mode === 'login';

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const verify = async () => {
    setBusy(true);
    // Supabase: supabase.auth.verifyOtp({ phone, token: code, type: 'sms' }) in build step 3.
    await new Promise((r) => setTimeout(r, 500));
    setBusy(false);
    if (login) {
      await logIn();
      router.replace('/home');
    } else {
      router.push('/profile-setup');
    }
  };

  return (
    <Screen
      back="back"
      footer={<Button label="Verify" disabled={code.length !== LEN} loading={busy} onPress={verify} />}>
      <StepHeader
        step={login ? undefined : 2}
        total={login ? undefined : 5}
        title="Enter the code"
        subtitle={`Sent to ${signupDraft.phone || 'your phone'}`}
      />
      <Pressable
        accessibilityLabel={`Verification code, ${code.length} of ${LEN} digits entered`}
        onPress={() => input.current?.focus()}
        style={styles.boxes}>
        {Array.from({ length: LEN }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.box,
              {
                backgroundColor: colors.surface,
                borderColor: i === code.length ? colors.primary : colors.border,
              },
            ]}>
            <Text style={styles.digit}>{code[i] ?? ''}</Text>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={input}
        autoFocus
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, LEN))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={LEN}
        style={styles.hidden}
      />
      <Button
        label={seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'}
        variant="ghost"
        size="md"
        disabled={seconds > 0}
        onPress={() => setSeconds(30)}
        style={styles.resend}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  box: {
    flex: 1,
    maxWidth: 56,
    height: 64,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontFamily: Fonts.bold, fontSize: 28, lineHeight: 34 },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  resend: { alignSelf: 'flex-start', marginTop: 16, paddingHorizontal: 0 },
});
