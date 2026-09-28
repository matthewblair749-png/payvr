import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card, ListRow, SectionLabel } from '@/components/list-row';
import { Text } from '@/components/text';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';

const THEME_LABEL = { dark: 'Dark', light: 'Light', system: 'System' } as const;

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { colors, preference } = useTheme();
  const { me, signOut, settings, contacts, userById, simulateIncomingPayment, simulateIncomingRequest } = useApp();

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
        <Button label="My QR code" icon="qr" variant="secondary" size="md" onPress={() => router.push('/qr')} style={styles.qr} />
      </View>

      <SectionLabel>People you’ve tapped</SectionLabel>
      <Card>
        {contacts.slice(0, 4).map((c, i, arr) => {
          const u = userById(c.userId);
          if (!u) return null;
          return (
            <ListRow
              key={c.userId}
              label={u.name}
              value={`@${u.handle}`}
              last={i === arr.length - 1}
              onPress={() => router.push({ pathname: '/person/[id]', params: { id: u.id } })}
            />
          );
        })}
      </Card>

      <SectionLabel>Money</SectionLabel>
      <Card>
        <ListRow icon="bank" label="Linked bank & card" value="Test" onPress={() => router.push('/settings/bank')} last />
      </Card>

      <SectionLabel>Settings</SectionLabel>
      <Card>
        <ListRow icon="shield" label="Security" onPress={() => router.push('/settings/security')} />
        <ListRow icon="bell" label="Notifications" value={settings.notificationsOn ? 'On' : 'Off'} onPress={() => router.push('/settings/notifications')} />
        <ListRow icon="moon" label="Appearance" value={THEME_LABEL[preference]} onPress={() => router.push('/settings/appearance')} last />
      </Card>

      <SectionLabel>About</SectionLabel>
      <Card>
        <ListRow icon="help" label="Help" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'help' } })} />
        <ListRow icon="file" label="Terms" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} />
        <ListRow icon="lock" label="Privacy" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} last />
      </Card>

      <SectionLabel>Prototype</SectionLabel>
      <Card>
        <ListRow icon="arrowDownLeft" label="Simulate: Jake pays you $20" onPress={() => { router.navigate('/home'); simulateIncomingPayment(); }} />
        <ListRow icon="request" label="Simulate: Priya requests $14.50" onPress={simulateIncomingRequest} last />
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
  qr: { alignSelf: 'stretch', marginTop: 8 },
  logout: { marginTop: 28 },
  version: { marginTop: 20 },
});
