import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { LogoGlyph } from '@/components/logo';
import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { useCountUp } from '@/hooks/use-count-up';
import { describe, useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { formatCents, formatShort } from '@/utils/money';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { me, balanceCents, transactions, userById, setDraft } = useApp();
  const shown = useCountUp(balanceCents);
  const first = me.name.split(' ')[0];

  const pending = transactions.filter((t) => describe(t, me.id).needsMyAction);
  const recent = transactions.slice(0, 5);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text variant="heading">Hi, {first}</Text>
        <View style={styles.headerRight}>
          <IconButton icon="qr" label="QR code" filled onPress={() => router.push('/qr')} />
          <Pressable accessibilityRole="button" accessibilityLabel="Your profile" onPress={() => router.navigate('/profile')} hitSlop={4}>
            <Avatar name={me.name} uri={me.avatarUrl} size={MIN_TAP} />
          </Pressable>
        </View>
      </View>

      <View style={styles.balance}>
        <Text variant="caption" color="textSecondary">
          Balance · Test money
        </Text>
        <Text variant="hero" adjustsFontSizeToFit numberOfLines={1} accessibilityLabel={`Balance ${formatCents(balanceCents)}`}>
          {formatCents(shown)}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Add money" icon="plus" variant="secondary" size="md" style={styles.flex} onPress={() => router.push({ pathname: '/wallet/[action]', params: { action: 'add' } })} />
        <Button label="Cash out" icon="arrowDown" variant="secondary" size="md" style={styles.flex} onPress={() => router.push({ pathname: '/wallet/[action]', params: { action: 'cashout' } })} />
      </View>

      {pending.map((req) => {
        const who = userById(req.toUser);
        return (
          <Pressable
            key={req.id}
            accessibilityRole="button"
            accessibilityLabel={`${who?.name} is requesting ${formatShort(req.amountCents)}. Review`}
            onPress={() => router.push({ pathname: '/request/[id]', params: { id: req.id } })}
            style={[styles.request, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Avatar name={who?.name ?? '?'} uri={who?.avatarUrl} size={40} />
            <View style={styles.flex}>
              <Text variant="bodyMedium">
                {who?.name.split(' ')[0]} is requesting {formatShort(req.amountCents)}
              </Text>
              <Text variant="small" color="textSecondary">
                {req.note}
              </Text>
            </View>
            <Text variant="bodyMedium" color="accent">
              Review
            </Text>
          </Pressable>
        );
      })}

      <View style={styles.tapWrap}>
        <TapButton
          onPress={() => {
            haptics.medium();
            setDraft(null);
            router.push('/amount');
          }}
        />
      </View>

      <View style={styles.recentHeader}>
        <Text variant="heading">Recent</Text>
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/activity')} style={styles.seeAll}>
          <Text variant="bodyMedium" color="accent">
            See all
          </Text>
        </Pressable>
      </View>
      {recent.map((tx) => (
        <TransactionRow key={tx.id} tx={tx} />
      ))}
    </ScrollView>
  );
}

function TapButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.25 }],
  }));

  return (
    <View style={styles.tapOuter}>
      <Animated.View style={[{ pointerEvents: 'none' }, styles.tapRing, { borderColor: colors.primary }, ring]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tap to send"
        onPress={onPress}
        style={({ pressed }) => [styles.tap, { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
        <LogoGlyph size={64} color={colors.onPrimary} />
        <Text variant="button" style={{ color: colors.onPrimary }}>
          Tap to send
        </Text>
      </Pressable>
    </View>
  );
}

const TAP = 188;

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  balance: { marginTop: 24, gap: 2 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  flex: { flex: 1 },
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 16,
  },
  tapWrap: { alignItems: 'center', marginVertical: 36 },
  tapOuter: { width: TAP, height: TAP, alignItems: 'center', justifyContent: 'center' },
  tapRing: { position: 'absolute', width: TAP, height: TAP, borderRadius: TAP / 2, borderWidth: 2 },
  tap: {
    width: TAP,
    height: TAP,
    borderRadius: TAP / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  seeAll: { minHeight: MIN_TAP, justifyContent: 'center' },
});
