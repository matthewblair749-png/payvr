import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { LogoGlyph } from '@/components/logo';
import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { useCountUp } from '@/hooks/use-count-up';
import { describe, useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';
import { isToday } from '@/utils/dates';
import { haptics } from '@/utils/haptics';
import { formatCents, formatShort } from '@/utils/money';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { me, balanceCents, transactions, contacts, userById, setDraft } = useApp();
  const shown = useCountUp(balanceCents);
  const first = me.name.split(' ')[0];

  const pending = transactions.filter((t) => describe(t, me.id).needsMyAction);
  const recent = transactions.slice(0, 5);
  const people = contacts.map((c) => userById(c.userId)).filter((u) => !!u).slice(0, 8);
  const receivedToday = useMemo(
    () =>
      transactions
        .filter((t) => describe(t, me.id).received && isToday(t.completedAt ?? t.createdAt))
        .reduce((s, t) => s + t.amountCents, 0),
    [transactions, me.id],
  );

  const startTap = () => {
    haptics.medium();
    setDraft(null);
    router.push('/amount');
  };

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

      {/* Balance card */}
      <View style={[styles.balanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.balanceTop}>
          <Text variant="caption" color="textSecondary">
            Payvr balance
          </Text>
          <View style={[styles.testChip, { borderColor: colors.border }]}>
            <View style={[styles.testDot, { backgroundColor: colors.accent }]} />
            <Text variant="caption" color="textSecondary">
              Test money
            </Text>
          </View>
        </View>
        <Text variant="hero" adjustsFontSizeToFit numberOfLines={1} accessibilityLabel={`Balance ${formatCents(balanceCents)}`}>
          {formatCents(shown)}
        </Text>
        <Text variant="small" color={receivedToday ? 'successText' : 'textSecondary'} style={styles.delta}>
          {receivedToday ? `+${formatShort(receivedToday)} received today` : 'Instant, free transfers'}
        </Text>
        <View style={styles.actions}>
          <CardAction icon="plus" label="Add money" onPress={() => router.push({ pathname: '/wallet/[action]', params: { action: 'add' } })} />
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <CardAction icon="arrowDown" label="Cash out" onPress={() => router.push({ pathname: '/wallet/[action]', params: { action: 'cashout' } })} />
        </View>
      </View>

      {pending.map((req) => {
        const who = userById(req.toUser);
        return (
          <Pressable
            key={req.id}
            accessibilityRole="button"
            accessibilityLabel={`${who?.name} is requesting ${formatShort(req.amountCents)}. Review`}
            onPress={() => router.push({ pathname: '/request/[id]', params: { id: req.id } })}
            style={({ pressed }) => [
              styles.request,
              { backgroundColor: colors.surface, borderColor: colors.accent, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Avatar name={who?.name ?? '?'} uri={who?.avatarUrl} size={40} />
            <View style={styles.flex}>
              <Text variant="bodyMedium">
                {who?.name.split(' ')[0]} is requesting {formatShort(req.amountCents)}
              </Text>
              <Text variant="small" color="textSecondary">
                {req.note || 'No note'}
              </Text>
            </View>
            <View style={[styles.reviewPill, { backgroundColor: colors.primary }]}>
              <Text variant="caption" style={{ color: colors.onPrimary }}>
                Review
              </Text>
            </View>
          </Pressable>
        );
      })}

      {/* The one big action */}
      <View style={styles.tapWrap}>
        <TapButton onPress={startTap} />
        <Text variant="small" color="textSecondary" align="center" style={styles.tapHint}>
          Hold your phone near a friend’s to pay
        </Text>
      </View>

      {people.length ? (
        <>
          <View style={styles.sectionHeader}>
            <Text variant="heading">People</Text>
            <Text variant="caption" color="textSecondary">
              Pay remotely
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people} style={styles.peopleScroll}>
            {people.map((u) => (
              <Pressable
                key={u!.id}
                accessibilityRole="button"
                accessibilityLabel={`${u!.name}, pay or request`}
                onPress={() => router.push({ pathname: '/person/[id]', params: { id: u!.id } })}
                style={({ pressed }) => [styles.person, { opacity: pressed ? 0.6 : 1 }]}>
                <Avatar name={u!.name} uri={u!.avatarUrl} size={56} />
                <Text variant="caption" numberOfLines={1} align="center">
                  {u!.name.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text variant="heading">Recent</Text>
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/activity')} style={styles.seeAll}>
          <Text variant="bodyMedium" color="accent">
            See all
          </Text>
        </Pressable>
      </View>
      {recent.length ? (
        recent.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
      ) : (
        <Text color="textSecondary" style={styles.empty}>
          No payments yet. Tap phones with a friend to send your first one.
        </Text>
      )}
    </ScrollView>
  );
}

function CardAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.cardAction, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={[styles.cardActionIcon, { backgroundColor: colors.background }]}>
        <Icon name={icon} size={18} color={colors.accent} strokeWidth={2.4} />
      </View>
      <Text variant="bodyMedium">{label}</Text>
    </Pressable>
  );
}

function TapButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.22 }],
  }));

  return (
    <View style={styles.tapOuter}>
      <View style={[styles.staticRing, { borderColor: colors.border }]} />
      <Animated.View style={[{ pointerEvents: 'none' }, styles.tapRing, { borderColor: colors.primary }, ring]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tap to send"
        onPress={onPress}
        style={({ pressed }) => [styles.tap, { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
        <LogoGlyph size={58} color={colors.onPrimary} />
        <Text variant="button" style={{ color: colors.onPrimary }}>
          Tap to send
        </Text>
      </Pressable>
    </View>
  );
}

const TAP = 172;
const RING = TAP + 36;

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  balanceCard: {
    marginTop: 16,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 18,
    paddingHorizontal: 20,
  },
  balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  testChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  testDot: { width: 6, height: 6, borderRadius: 3 },
  delta: { marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginHorizontal: -20 },
  actionDivider: { width: StyleSheet.hairlineWidth, height: 28 },
  cardAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 60 },
  cardActionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 12,
  },
  reviewPill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tapWrap: { alignItems: 'center', marginTop: 30, marginBottom: 10 },
  tapOuter: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  staticRing: { position: 'absolute', width: RING, height: RING, borderRadius: RING / 2, borderWidth: 1 },
  tapRing: { position: 'absolute', width: TAP, height: TAP, borderRadius: TAP / 2, borderWidth: 2 },
  tap: { width: TAP, height: TAP, borderRadius: TAP / 2, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tapHint: { marginTop: 10 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    minHeight: MIN_TAP,
    paddingHorizontal: 4,
  },
  peopleScroll: { marginHorizontal: -20 },
  people: { paddingHorizontal: 20, gap: 14 },
  person: { width: 64, alignItems: 'center', gap: 6, minHeight: MIN_TAP },
  seeAll: { minHeight: MIN_TAP, minWidth: MIN_TAP, justifyContent: 'center', alignItems: 'flex-end' },
  empty: { marginTop: 8 },
});
