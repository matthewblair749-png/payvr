import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
import { Card, ListRow, SectionLabel } from '@/components/list-row';
import { PinPad } from '@/components/pin-pad';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { Toggle } from '@/components/toggle';
import { biometricKind, type BiometricKind } from '@/services/biometrics';
import { DAILY_SEND_LIMIT_CENTS } from '@/services/payments';
import { storage, StorageKeys } from '@/services/storage';
import { useApp } from '@/store/app-store';
import { useAuthorize } from '@/store/authorize';
import { useTheme } from '@/theme/theme-provider';
import { formatShort } from '@/utils/money';

export default function Security() {
  const { settings, updateSettings, sentTodayCents } = useApp();
  const authorize = useAuthorize();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<BiometricKind>(null);
  const [changing, setChanging] = useState(false);
  const [first, setFirst] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    biometricKind().then(setKind);
  }, []);

  return (
    <Screen back="back" title="Security" scroll>
      <SectionLabel>Payments</SectionLabel>
      <Card>
        <ListRow
          icon="faceId"
          label={kind ?? 'Face ID'}
          right={
            <Toggle
              label={kind ?? 'Face ID'}
              value={settings.biometricsOn && !!kind}
              onChange={(v) => updateSettings({ biometricsOn: v })}
            />
          }
        />
        <ListRow
          icon="lock"
          label="Change PIN"
          value={saved ? 'Updated' : undefined}
          last
          onPress={async () => {
            if (await authorize('Confirm it’s you to change your PIN')) {
              setFirst(null);
              setChanging(true);
            }
          }}
        />
      </Card>
      {!kind ? (
        <Text variant="small" color="textSecondary" style={styles.note}>
          Face ID isn’t available here, so payments use your PIN.
        </Text>
      ) : null}

      <SectionLabel>Limits</SectionLabel>
      <Card>
        <ListRow label="Daily send limit" value={formatShort(DAILY_SEND_LIMIT_CENTS)} />
        <ListRow label="Sent in the last 24 hours" value={formatShort(sentTodayCents)} last />
      </Card>
      <Text variant="small" color="textSecondary" style={styles.note}>
        The prototype caps sending at $500 in any 24 hours. Every payment needs Face ID or your PIN, and tap sessions close after 60 seconds.
      </Text>

      <Modal visible={changing} animationType="slide" onRequestClose={() => setChanging(false)}>
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
          <IconButton icon="close" label="Cancel" onPress={() => setChanging(false)} />
          <PinPad
            key={first ? 'confirm' : 'new'}
            title={first ? 'Confirm new PIN' : 'New PIN'}
            onComplete={(p) => {
              if (!first) {
                setFirst(p);
                return;
              }
              if (p !== first) {
                setFirst(null);
                return false;
              }
              storage.set(StorageKeys.pin, p);
              setSaved(true);
              setChanging(false);
            }}
          />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: 10, marginLeft: 4 },
  sheet: { flex: 1, paddingHorizontal: 24 },
});
