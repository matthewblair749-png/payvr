import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Card, ListRow, SectionLabel } from '@/components/list-row';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { buildQr } from '@/services/qr';
import { useCall } from '@/store/call-store';
import { useApp } from '@/store/app-store';
import { PRIVACY_LABEL, useSocial } from '@/store/social-store';
import { useTheme } from '@/theme/theme-provider';

const THEME_LABEL = { dark: 'Dark', light: 'Light', system: 'System' } as const;

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { colors, preference } = useTheme();
  const { simulateIncomingCall } = useCall();
  const { me, signOut, settings, simulateIncomingPayment, simulateIncomingRequest } = useApp();
  const { defaultPrivacy } = useSocial();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
      showsVerticalScrollIndicator={false}>
      <View style={[styles.me, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Avatar name={me.name} uri={me.avatarUrl} size={88} />
        <Text variant="title" align="center">
          {me.name}
        </Text>
        <View style={[styles.handle, { borderColor: colors.border }]}>
          <Text variant="bodyMedium" color="accent">
            @{me.handle}
          </Text>
        </View>
        <PressableScale
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel="Your QR code. Scan to pay me. Opens full screen"
          onPress={() => router.push('/qr')}
          style={({ pressed }) => [styles.qr]}>
          <QRCode value={buildQr(me.handle)} size={168} color="#0A0A0A" backgroundColor="#FFFFFF" ecl="M" />
        </PressableScale>
        <Text variant="small" color="textSecondary">
          Scan to pay me
        </Text>
      </View>

      <SectionLabel>People</SectionLabel>
      <Card>
        <ListRow icon="users" label="Find people" onPress={() => router.push('/people')} last />
      </Card>

      <SectionLabel>Settings</SectionLabel>
      <Card>
        <ListRow icon="shield" label="Security" value="Face ID · PIN" onPress={() => router.push('/settings/security')} />
        <ListRow icon="globe" label="Privacy" value={PRIVACY_LABEL[defaultPrivacy]} onPress={() => router.push('/settings/privacy')} />
        <ListRow icon="bell" label="Notifications" value={settings.notificationsOn ? 'On' : 'Off'} onPress={() => router.push('/settings/notifications')} />
        <ListRow icon="moon" label="Appearance" value={THEME_LABEL[preference]} onPress={() => router.push('/settings/appearance')} last />
      </Card>

      <SectionLabel>About</SectionLabel>
      <Card>
        <ListRow icon="help" label="Help" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'help' } })} />
        <ListRow icon="file" label="Terms" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} />
        <ListRow icon="lock" label="Privacy policy" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} last />
      </Card>

      <SectionLabel>Prototype</SectionLabel>
      <Card>
        <ListRow icon="arrowDownLeft" label="Simulate: Jake pays you $20" onPress={() => { router.navigate('/home'); simulateIncomingPayment(); }} />
        <ListRow icon="request" label="Simulate: Priya requests $14.50" onPress={simulateIncomingRequest} />
        <ListRow icon="video" label="Simulate: Sofia video-calls you" onPress={() => simulateIncomingCall('u_sofia', 'video')} />
        <ListRow icon="call" label="Simulate: Leo calls you" onPress={() => simulateIncomingCall('u_leo', 'audio')} last />
      </Card>

      <Card style={styles.logout}>
        <ListRow
          icon="logout"
          label="Log out"
          danger
          last
          onPress={async () => {
            await signOut();
            router.replace('/onboarding');
          }}
        />
      </Card>
      <Text variant="caption" color="textSecondary" align="center" style={styles.version}>
        payvr prototype · test mode · no real money
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  me: {
    alignItems: 'center',
    gap: 8,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  handle: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4 },
  qr: { marginTop: 12, padding: 14, borderRadius: 20, backgroundColor: '#FFFFFF' },
  logout: { marginTop: 28 },
  version: { marginTop: 20 },
});
