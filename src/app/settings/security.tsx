import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Card, ListRow, SectionLabel, ToggleRow } from '@/components/list-row';
import { PinPad } from '@/components/pin-pad';
import { Screen } from '@/components/screen';
import { Figure, Footnote, Meter, Section, SettingsHero } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { biometricKind, type BiometricKind } from '@/services/biometrics';
import { storage, StorageKeys } from '@/services/storage';
import { useAccount } from '@/store/account';
import { useApp } from '@/store/app-store';
import { useAuthorize } from '@/store/authorize';
import { useTheme } from '@/theme/theme-provider';
import { formatShort } from '@/utils/money';

const DEVICE_NAME = Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android phone' : 'browser';

export default function Security() {
  const { settings, updateSettings, sentTodayCents } = useApp();
  const { dailyLimitCents } = useAccount();
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
  const bioOn = settings.biometricsOn && !!kind;
  const left = Math.max(0, dailyLimitCents - sentTodayCents);

  return (
    <Screen back="back" scroll>
      <SettingsHero icon="shield" title="Security" body="Every payment needs your face or your PIN. Here’s how your account is protected." />

      <Section index={1} style={[styles.status, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.statusHead}>
          <View style={[styles.badge, { backgroundColor: colors.success + '22' }]}>
            <Icon name="check" size={16} color={colors.success} strokeWidth={3} />
          </View>
          <Text variant="bodyMedium">Your account is protected</Text>
        </View>
        {[
          `${bioOn ? kind : 'PIN'} confirms every payment`,
          `Sending is capped at ${formatShort(dailyLimitCents)} a day`,
          'Tap-to-pay sessions close after 60 seconds',
        ].map((line) => (
          <View key={line} style={styles.check}>
            <Icon name="check" size={14} color={colors.textSecondary} strokeWidth={2.6} />
            <Text variant="small" color="textSecondary">
              {line}
            </Text>
          </View>
        ))}
      </Section>

      <Section index={2}>
        <SectionLabel>Confirm payments with</SectionLabel>
        <Card>
          <ToggleRow
            icon="faceId"
            label={kind ?? 'Face ID'}
            hint={kind ? 'Fastest way to approve a payment' : 'Not available on this device'}
            value={bioOn}
            onChange={(v) => updateSettings({ biometricsOn: v })}
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
        {!kind ? <Footnote>Face ID isn’t available here, so payments use your PIN.</Footnote> : null}
      </Section>

      <Section index={3}>
        <SectionLabel>Daily limit</SectionLabel>
        <View
          accessible
          accessibilityLabel={`${formatShort(left)} left to send today, out of ${formatShort(dailyLimitCents)}`}
          style={[styles.limit, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.limitHead}>
            <View>
              <Figure>{formatShort(left)}</Figure>
              <Text variant="small" color="textSecondary">
                left to send today
              </Text>
            </View>
            <Text variant="small" color="textSecondary">
              of {formatShort(dailyLimitCents)}
            </Text>
          </View>
          <Meter value={sentTodayCents} max={dailyLimitCents} />
          <Text variant="caption" color="textSecondary">
            {formatShort(sentTodayCents)} sent in the last 24 hours
          </Text>
        </View>
        <Footnote>The limit is a rolling 24 hours, so it frees up as earlier payments age out.</Footnote>
      </Section>

      <Section index={4}>
        <SectionLabel>Devices</SectionLabel>
        <Card>
          <ListRow icon="phone" label={`This ${DEVICE_NAME}`} value="Active now" last />
        </Card>
        <Footnote>Signing in on a new device needs a code sent to your phone, and payments there still need its own Face ID or PIN.</Footnote>
      </Section>

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
  status: { marginTop: 20, padding: 16, gap: 8, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 7 },
  limit: { padding: 16, gap: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  limitHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sheet: { flex: 1, paddingHorizontal: 24 },
});
