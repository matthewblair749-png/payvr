import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { StepHeader } from '@/components/step-header';
import { Text } from '@/components/text';
import { authenticateBiometric, biometricKind, type BiometricKind } from '@/services/biometrics';
import { storage, StorageKeys } from '@/services/storage';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';

export default function SecuritySetup() {
  const { colors } = useTheme();
  const { updateSettings } = useApp();
  const [kind, setKind] = useState<BiometricKind>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    biometricKind().then((k) => {
      setKind(k);
      setChecked(true);
    });
  }, []);

  const label = kind ?? 'Face ID';

  const enable = async () => {
    const ok = kind ? await authenticateBiometric(`Turn on ${label} for Payvr`) : true;
    updateSettings({ biometricsOn: ok && !!kind });
    await storage.set(StorageKeys.biometrics, ok && kind ? '1' : '0');
    router.push('/pin-setup');
  };

  return (
    <Screen
      back="back"
      footer={
        <>
          <Button label={kind || !checked ? `Use ${label}` : 'Continue'} icon="faceId" onPress={enable} />
          <Button
            label="Not now"
            variant="ghost"
            onPress={() => {
              updateSettings({ biometricsOn: false });
              router.push('/pin-setup');
            }}
          />
        </>
      }>
      <StepHeader step={6} total={6} title={`Pay with ${label}`} subtitle="Every payment needs your face, fingerprint or PIN. Nobody can send your money but you." />
      <View style={styles.art}>
        <View style={[styles.circle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="faceId" size={72} color={colors.accent} strokeWidth={1.6} />
        </View>
        {checked && !kind ? (
          <Text variant="small" color="textSecondary" align="center" style={styles.note}>
            Biometrics aren’t available on this device, so you’ll use a PIN.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { maxWidth: 280 },
});
