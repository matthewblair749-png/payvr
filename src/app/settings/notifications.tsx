import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, ToggleRow } from '@/components/list-row';
import { PayvrLogo } from '@/components/payvr-logo';
import { Screen } from '@/components/screen';
import { Footnote, Section, SettingsHero } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { useApp } from '@/store/app-store';
import { BRAND_BLUE } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';

export default function Notifications() {
  const { colors } = useTheme();
  const { settings, updateSettings, push, backendMode } = useApp();
  const on = settings.notificationsOn;
  const previewOn = on && settings.notifyPayments;

  const problem =
    !on || !push || 'token' in push
      ? null
      : push.error === 'denied'
        ? { text: 'Notifications are turned off for Payvr in your phone’s Settings.', settings: true }
        : push.error === 'unsupported'
          ? { text: 'Push notifications need a real phone (not a simulator or the web preview).', settings: false }
          : push.error === 'no_project'
            ? { text: 'Push isn’t set up for this build yet: it needs an EAS project ID (see docs/PUSH.md).', settings: false }
            : { text: 'Couldn’t turn on push notifications. Try again later.', settings: false };

  return (
    <Screen back="back" scroll>
      <SettingsHero icon="bell" title="Notifications" body="Know the moment money arrives or someone asks you for some." />

      {/* What a notification looks like */}
      <Section index={1} style={styles.previewWrap}>
        <View
          accessible
          accessibilityLabel={previewOn ? 'Example notification: Jake paid you $20 for pizza' : 'Notifications for money received are off'}
          style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border, opacity: previewOn ? 1 : 0.45 }]}>
          <View style={styles.appIcon}>
            <PayvrLogo size={22} color="#FFFFFF" cutColor={BRAND_BLUE} />
          </View>
          <View style={styles.flex}>
            <View style={styles.bannerTop}>
              <Text variant="caption" color="textSecondary">
                PAYVR
              </Text>
              <Text variant="caption" color="textSecondary">
                now
              </Text>
            </View>
            <Text variant="bodyMedium">Jake paid you $20</Text>
            <Text variant="small" color="textSecondary">
              🍕 Pizza
            </Text>
          </View>
        </View>
        <Text variant="caption" color="textSecondary" align="center" style={styles.previewCaption}>
          {previewOn ? 'This is what you’ll see' : 'You won’t get alerts for money received'}
        </Text>
      </Section>

      <Section index={2}>
        <Card>
          <ToggleRow
            icon="bell"
            label="Push notifications"
            hint={on ? 'On for this device' : 'Off. You’ll still see everything in the app'}
            last={!on}
            value={on}
            onChange={(v) => updateSettings({ notificationsOn: v })}
          />
          {on ? (
            <>
              <ToggleRow
                icon="arrowDownLeft"
                label="Money received"
                hint="When someone pays you"
                value={settings.notifyPayments}
                onChange={(v) => updateSettings({ notifyPayments: v })}
              />
              <ToggleRow
                icon="request"
                label="Requests"
                hint="When someone asks you to pay"
                last
                value={settings.notifyRequests}
                onChange={(v) => updateSettings({ notifyRequests: v })}
              />
            </>
          ) : null}
        </Card>
        {backendMode === 'mock' ? <Footnote>Prototype mode: real pushes are sent once Supabase is connected.</Footnote> : null}
        {problem ? (
          <>
            <Footnote tone="error">{problem.text}</Footnote>
            {problem.settings ? (
              <Button label="Open Settings" variant="secondary" size="md" onPress={() => Linking.openSettings()} style={styles.button} />
            ) : null}
          </>
        ) : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  previewWrap: { marginTop: 20, marginBottom: 24 },
  banner: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  appIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: BRAND_BLUE, alignItems: 'center', justifyContent: 'center' },
  bannerTop: { flexDirection: 'row', justifyContent: 'space-between' },
  previewCaption: { marginTop: 8 },
  button: { marginTop: 12 },
});
