import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useOpenPayvrCode } from '@/hooks/use-open-payvr-code';
import { fromParts } from '@/services/qr';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';

/**
 * Deep link target for Payvr QR codes (payvr://u/<handle>?amt=…), so scanning with
 * the phone's own camera app opens straight into the right Payvr screen.
 */
export default function PayvrLink() {
  const params = useLocalSearchParams<{ handle: string; amt?: string; note?: string; exp?: string; ref?: string }>();
  const { status } = useApp();
  const { colors } = useTheme();
  const open = useOpenPayvrCode();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (status !== 'signedIn' || started.current) return;
    started.current = true;
    const parsed = fromParts(params.handle ?? '', { amt: params.amt, note: params.note, exp: params.exp, ref: params.ref });
    open(parsed).then(setError);
  }, [status, params, open]);

  if (status === 'signedOut' || status === 'needsProfile') return <Redirect href="/" />;

  return (
    <Screen back="close" footer={error ? <Button label="Go home" onPress={() => router.replace('/home')} /> : undefined}>
      <View style={styles.center}>
        {error ? (
          <Text variant="heading" align="center">
            {error}
          </Text>
        ) : (
          <ActivityIndicator color={colors.accent} size="large" />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
