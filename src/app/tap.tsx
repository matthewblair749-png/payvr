import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { LogoGlyph } from '@/components/logo';
import { PulseRings } from '@/components/pulse-rings';
import { Text } from '@/components/text';
import type { User } from '@/data/types';
import { startDiscovery, TAP_SESSION_MS } from '@/services/nearby';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { formatShort } from '@/utils/money';

type Phase = 'searching' | 'found' | 'expired';

export default function Tap() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { draft, setDraft, contacts, userById } = useApp();
  const [phase, setPhase] = useState<Phase>('searching');
  const [peer, setPeer] = useState<User | null>(null);
  const [remaining, setRemaining] = useState(TAP_SESSION_MS / 1000);
  const [attempt, setAttempt] = useState(0);
  const sheet = useSharedValue(400);
  const startedAt = useRef(Date.now());

  // Discovery + 60s session expiry. Only this screen advertises / scans.
  useEffect(() => {
    startedAt.current = Date.now();
    setRemaining(TAP_SESSION_MS / 1000);
    setPhase('searching');
    setPeer(null);
    sheet.value = 400;

    const discovery = startDiscovery({
      candidates: contacts.map((c) => c.userId),
      onFound: ({ userId }) => {
        const u = userById(userId);
        if (!u) return;
        haptics.success();
        setPeer(u);
        setPhase('found');
        sheet.value = withSpring(0, { damping: 18, stiffness: 180 });
      },
    });
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((TAP_SESSION_MS - (Date.now() - startedAt.current)) / 1000));
      setRemaining(left);
      if (left === 0) {
        discovery.stop();
        setPhase((p) => (p === 'searching' ? 'expired' : p));
        clearInterval(tick);
      }
    }, 500);
    return () => {
      discovery.stop();
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheet.value }] }));

  const notThem = useCallback(() => {
    sheet.value = withTiming(400, { duration: 200 });
    setAttempt((a) => a + 1);
  }, [sheet]);

  if (!draft) {
    return null;
  }

  const verb = draft.mode === 'send' ? 'Sending' : 'Requesting';

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.top}>
        <Text variant="caption" color="textSecondary">
          {verb} {formatShort(draft.amountCents)}
          {draft.note ? ` · ${draft.note}` : ''}
        </Text>
        {phase === 'searching' ? (
          <Text variant="caption" color="textSecondary" accessibilityLabel={`Session expires in ${remaining} seconds`}>
            {`0:${String(remaining).padStart(2, '0')}`}
          </Text>
        ) : null}
      </View>

      <View style={styles.center}>
        {phase === 'expired' ? (
          <View style={styles.expired}>
            <View style={[styles.expiredIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <LogoGlyph size={56} color={colors.textSecondary} />
            </View>
            <Text variant="title" align="center">
              Didn’t find anyone
            </Text>
            <Text color="textSecondary" align="center" style={styles.expiredBody}>
              Tap sessions close after 60 seconds to keep you safe. Make sure their Payvr is open on the Tap screen, then try again.
            </Text>
            <Button label="Try again" onPress={() => setAttempt((a) => a + 1)} style={styles.retry} />
          </View>
        ) : (
          <>
            <Text variant="title" align="center" style={styles.title} accessibilityRole="header">
              {phase === 'found' ? 'Found them' : 'Hold your phone\nnear theirs'}
            </Text>
            <PulseRings size={132} active={phase === 'searching'}>
              <View style={[styles.logo, { backgroundColor: colors.primary }]}>
                <LogoGlyph size={84} color={colors.onPrimary} />
              </View>
            </PulseRings>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/qr')}
              style={styles.qrLink}>
              <Icon name="qr" size={18} color={colors.accent} />
              <Text variant="bodyMedium" color="accent">
                Show QR code instead
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <Button
        label="Cancel"
        variant="secondary"
        onPress={() => {
          setDraft(null);
          router.back();
        }}
        style={styles.cancel}
      />

      {peer ? (
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) + 8 },
            sheetStyle,
          ]}
          accessibilityViewIsModal>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <View style={styles.peerRow}>
            <Avatar name={peer.name} uri={peer.avatarUrl} size={64} ring />
            <View style={styles.flex}>
              <Text variant="heading">{peer.name}</Text>
              <Text color="textSecondary">@{peer.handle}</Text>
            </View>
          </View>
          <Button
            label={`Continue with ${peer.name.split(' ')[0]}`}
            onPress={() => {
              setDraft({ ...draft, peerId: peer.id });
              router.replace('/confirm');
            }}
          />
          <Button label="Not them? Keep looking" variant="ghost" size="md" onPress={notThem} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, minHeight: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { marginBottom: 8 },
  logo: { width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center' },
  qrLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: MIN_TAP, paddingHorizontal: 12 },
  cancel: { marginHorizontal: 24 },
  expired: { alignItems: 'center', paddingHorizontal: 24, gap: 10 },
  expiredIcon: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  expiredBody: { maxWidth: 320 },
  retry: { marginTop: 18, alignSelf: 'stretch' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingTop: 10,
    gap: 12,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  peerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
});
