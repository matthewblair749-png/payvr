import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Icon, type IconName } from '@/components/icon';
import { Card, SectionLabel } from '@/components/list-row';
import { LogoGlyph } from '@/components/logo';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import type { User } from '@/data/types';
import { buildQr } from '@/services/qr';
import { useCall } from '@/store/call-store';
import { useApp } from '@/store/app-store';
import { PRIVACY_LABEL, useSocial } from '@/store/social-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { listEnter } from '@/utils/motion';

const THEME_LABEL = { dark: 'Dark', light: 'Light', system: 'System' } as const;

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { colors, preference } = useTheme();
  const { simulateIncomingCall } = useCall();
  const { me, contacts, transactions, userById, signOut, settings, simulateIncomingPayment, simulateIncomingRequest } = useApp();
  const { defaultPrivacy } = useSocial();

  const friends = useMemo(
    () => contacts.map((c) => userById(c.userId)).filter((u): u is User => !!u && u.id !== me.id),
    [contacts, userById, me.id],
  );
  const tapped = contacts.filter((c) => c.viaTap).length;
  const payments = transactions.filter((t) => t.status === 'completed').length;

  const openLegal = (doc: 'help' | 'terms' | 'privacy') => router.push({ pathname: '/legal/[doc]', params: { doc } });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Animated.View entering={listEnter(0)} style={styles.hero}>
        <View style={[styles.avatarRing, { borderColor: colors.primary }]}>
          <View style={[styles.avatarGap, { borderColor: colors.background }]}>
            <Avatar name={me.name} uri={me.avatarUrl} size={96} />
          </View>
        </View>
        <Text variant="title" align="center" accessibilityRole="header" style={styles.name}>
          {me.name}
        </Text>
        <PressableScale
          scaleTo={0.96}
          haptic="tap"
          accessibilityRole="button"
          accessibilityLabel={`@${me.handle}. Show my QR code`}
          onPress={() => router.push('/qr')}
          style={[styles.handle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LogoGlyph size={14} color={colors.accent} />
          <Text variant="bodyMedium" color="text">
            @{me.handle}
          </Text>
        </PressableScale>
      </Animated.View>

      {/* Stats */}
      <Animated.View entering={listEnter(1)} style={[styles.stats, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Stat value={friends.length} label="Friends" onPress={() => router.push('/people')} />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <Stat value={payments} label="Payments" onPress={() => router.navigate('/wallet')} />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <Stat value={tapped} label="Met in person" onPress={() => router.navigate('/tap')} />
      </Animated.View>

      {/* Pay me */}
      <Animated.View entering={listEnter(2)}>
        <PressableScale
          scaleTo={0.98}
          haptic="tap"
          accessibilityRole="button"
          accessibilityLabel="Your QR code. Anyone can scan it to pay you. Opens full screen"
          onPress={() => router.push('/qr')}
          style={[styles.payMe, { backgroundColor: colors.primary }]}>
          <View style={styles.qrTile}>
            <QRCode value={buildQr(me.handle)} size={76} color="#0A0A0A" backgroundColor="#FFFFFF" ecl="M" />
          </View>
          <View style={styles.payMeText}>
            <Text variant="heading" style={{ color: colors.onPrimary }}>
              Get paid fast
            </Text>
            <Text variant="small" style={{ color: colors.onPrimary, opacity: 0.85 }}>
              Anyone with Payvr can scan this to pay you.
            </Text>
          </View>
          <Icon name="chevronRight" size={20} color={colors.onPrimary} />
        </PressableScale>
      </Animated.View>

      {/* Friends */}
      {friends.length ? (
        <Animated.View entering={listEnter(3)}>
          <View style={styles.sectionHead}>
            <SectionLabel>Friends</SectionLabel>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="See all friends"
              onPress={() => router.push('/people')}
              style={styles.seeAll}>
              <Text variant="caption" color="accent">
                See all
              </Text>
            </PressableScale>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.friendsScroll} contentContainerStyle={styles.friends}>
            <PressableScale
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityLabel="Find people"
              onPress={() => router.push('/people')}
              style={styles.friend}>
              <View style={[styles.addFriend, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Icon name="plus" size={24} color={colors.accent} />
              </View>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                Add
              </Text>
            </PressableScale>
            {friends.slice(0, 10).map((u) => (
              <PressableScale
                key={u.id}
                scaleTo={0.94}
                accessibilityRole="button"
                accessibilityLabel={`${u.name}, @${u.handle}`}
                onPress={() => router.push({ pathname: '/person/[id]', params: { id: u.id } })}
                style={styles.friend}>
                <Avatar name={u.name} uri={u.avatarUrl} size={56} />
                <Text variant="caption" numberOfLines={1}>
                  {u.name.split(' ')[0]}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}

      {/* Settings */}
      <Animated.View entering={listEnter(4)}>
        <SectionLabel>Settings</SectionLabel>
        <Card>
          <Row icon="shield" label="Security" value="Face ID · PIN" onPress={() => router.push('/settings/security')} />
          <Row icon="globe" label="Privacy" value={PRIVACY_LABEL[defaultPrivacy]} onPress={() => router.push('/settings/privacy')} />
          <Row
            icon="bell"
            label="Notifications"
            value={settings.notificationsOn ? 'On' : 'Off'}
            onPress={() => router.push('/settings/notifications')}
          />
          <Row icon="moon" label="Appearance" value={THEME_LABEL[preference]} onPress={() => router.push('/settings/appearance')} last />
        </Card>
      </Animated.View>

      <Animated.View entering={listEnter(5)}>
        <SectionLabel>Support</SectionLabel>
        <Card>
          <Row icon="help" label="Help" onPress={() => openLegal('help')} />
          <Row icon="file" label="Terms" onPress={() => openLegal('terms')} />
          <Row icon="lock" label="Privacy policy" onPress={() => openLegal('privacy')} last />
        </Card>
      </Animated.View>

      <Animated.View entering={listEnter(6)}>
        <SectionLabel>Try it out</SectionLabel>
        <Card>
          <Row
            icon="arrowDownLeft"
            label="Jake pays you $20"
            onPress={() => {
              router.navigate('/home');
              simulateIncomingPayment();
            }}
          />
          <Row icon="request" label="Priya requests $14.50" onPress={simulateIncomingRequest} />
          <Row icon="video" label="Sofia video-calls you" onPress={() => simulateIncomingCall('u_sofia', 'video')} />
          <Row icon="call" label="Leo calls you" onPress={() => simulateIncomingCall('u_leo', 'audio')} last />
        </Card>
      </Animated.View>

      <Animated.View entering={listEnter(7)}>
        <PressableScale
          scaleTo={0.98}
          haptic="tap"
          accessibilityRole="button"
          accessibilityLabel="Log out"
          onPress={async () => {
            await signOut();
            router.replace('/onboarding');
          }}
          style={[styles.logout, { borderColor: colors.border }]}>
          <Icon name="logout" size={20} color={colors.error} />
          <Text variant="bodyMedium" style={{ color: colors.error }}>
            Log out
          </Text>
        </PressableScale>

        <View style={styles.footer}>
          <LogoGlyph size={18} color={colors.textSecondary} />
          <Text variant="caption" color="textSecondary" align="center">
            Payvr prototype · test mode · no real money
          </Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

function Stat({ value, label, icon, onPress }: { value: number; label: string; icon?: IconName; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.95}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <View style={styles.statLabel}>
        {icon ? <Icon name={icon} size={13} color={colors.textSecondary} /> : null}
        <Text variant="caption" color="textSecondary">
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

/** Settings row with the icon on a soft tinted tile. */
function Row({ icon, label, value, onPress, last }: { icon: IconName; label: string; value?: string; onPress: () => void; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.985}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.primary + '1F' }]}>
        <Icon name={icon} size={18} color={colors.accent} />
      </View>
      <View style={[styles.rowMain, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <Text variant="bodyMedium" style={styles.rowLabel}>
          {label}
        </Text>
        {value ? (
          <Text variant="small" color="textSecondary">
            {value}
          </Text>
        ) : null}
        <Icon name="chevronRight" size={18} color={colors.textSecondary} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 48 },

  hero: { alignItems: 'center', paddingTop: 12 },
  avatarRing: { borderWidth: 2, borderRadius: 999, padding: 0 },
  avatarGap: { borderWidth: 4, borderRadius: 999 },
  name: { marginTop: 14 },
  handle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    minHeight: MIN_TAP,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
  },
  stat: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 64, gap: 2 },
  statValue: { fontFamily: Fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32 },

  payMe: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14, padding: 14, paddingRight: 16, borderRadius: 24 },
  qrTile: { padding: 8, borderRadius: 14, backgroundColor: '#FFFFFF' },
  payMeText: { flex: 1, gap: 2 },

  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  seeAll: { minHeight: MIN_TAP, minWidth: MIN_TAP, justifyContent: 'flex-end', alignItems: 'flex-end', paddingBottom: 10 },
  friends: { gap: 14, paddingHorizontal: 20 },
  friendsScroll: { marginHorizontal: -20 },
  friend: { width: 60, alignItems: 'center', gap: 6 },
  addFriend: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 14, minHeight: 56 },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, paddingRight: 14 },
  rowLabel: { flex: 1 },

  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
  },
  footer: { alignItems: 'center', gap: 8, marginTop: 24 },
});
