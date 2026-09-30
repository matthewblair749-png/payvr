import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Card, ListRow, SectionLabel } from '@/components/list-row';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { WalletCard } from '@/components/wallet-card';
import { useCountUp } from '@/hooks/use-count-up';
import { DAILY_SEND_LIMIT_CENTS, STRIPE_MODE, TEST_FUNDING_SOURCES } from '@/services/payments';
import { storage } from '@/services/storage';
import { describe, useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { formatCents, formatShort } from '@/utils/money';
import { EASE, smooth } from '@/utils/motion';

const HIDE_KEY = 'payvr.hideBalance';

export default function Wallet() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { me, balanceCents, sentTodayCents, transactions, setDraft } = useApp();
  const shown = useCountUp(balanceCents);
  const [hidden, setHidden] = useState(false);
  const bank = STRIPE_MODE ? 'Stripe test account' : TEST_FUNDING_SOURCES[1].label;
  const recent = transactions.slice(0, 3);

  useEffect(() => {
    storage.get(HIDE_KEY).then((v) => setHidden(v === '1'));
  }, []);
  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    storage.set(HIDE_KEY, next ? '1' : '0');
  };

  const month = useMemo(() => {
    const now = new Date();
    let inCents = 0;
    let outCents = 0;
    for (const t of transactions) {
      const d = describe(t, me.id);
      const at = new Date(t.completedAt ?? t.createdAt);
      if (at.getMonth() !== now.getMonth() || at.getFullYear() !== now.getFullYear()) continue;
      if (d.received) inCents += t.amountCents;
      if (d.sent) outCents += t.amountCents;
    }
    return { label: now.toLocaleDateString('en-US', { month: 'long' }), inCents, outCents };
  }, [transactions, me.id]);

  const startPayment = (mode: 'send' | 'request') => {
    setDraft(null);
    router.push({ pathname: '/amount', params: { mode } });
  };

  const actions: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'plus', label: 'Add', onPress: () => router.push({ pathname: '/money/[action]', params: { action: 'add' } }) },
    { icon: 'bank', label: 'Cash out', onPress: () => router.push({ pathname: '/money/[action]', params: { action: 'cashout' } }) },
    { icon: 'send', label: 'Send', onPress: () => startPayment('send') },
    { icon: 'request', label: 'Request', onPress: () => startPayment('request') },
  ];

  const enter = (i: number) => FadeInDown.delay(60 + i * 60).duration(420).easing(EASE);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <Text variant="title" accessibilityRole="header">
          Wallet
        </Text>
        <IconButton icon={hidden ? 'eyeOff' : 'eye'} label={hidden ? 'Show balance' : 'Hide balance'} selected={hidden} onPress={toggleHidden} />
      </View>

      <Animated.View entering={enter(0)}>
        <WalletCard name={me.name} balanceCents={shown} hidden={hidden} />
      </Animated.View>

      <Animated.View entering={enter(1)} style={styles.actions}>
        {actions.map((a) => (
          <PressableScale key={a.label} scaleTo={0.92} haptic="tap" accessibilityRole="button" accessibilityLabel={a.label} onPress={a.onPress} style={styles.action}>
            <View style={[styles.actionIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Icon name={a.icon} size={22} color={colors.accent} />
            </View>
            <Text variant="caption">{a.label}</Text>
          </PressableScale>
        ))}
      </Animated.View>

      <Animated.View entering={enter(2)} style={styles.tiles}>
        <MonthTile label={month.label} inCents={month.inCents} outCents={month.outCents} hidden={hidden} />
        <LimitTile sent={sentTodayCents} limit={DAILY_SEND_LIMIT_CENTS} />
      </Animated.View>

      {recent.length ? (
        <Animated.View entering={enter(3)}>
          <View style={styles.sectionHead}>
            <SectionLabel>Recent</SectionLabel>
            <PressableScale
              scaleTo={0.94}
              accessibilityRole="link"
              accessibilityLabel="See all activity"
              onPress={() => router.navigate({ pathname: '/feed', params: { tab: 'me' } })}
              style={styles.seeAll}>
              <Text variant="caption" color="accent">
                See all
              </Text>
            </PressableScale>
          </View>
          {recent.map((t) => (
            <TransactionRow key={t.id} tx={t} />
          ))}
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(4)}>
        <SectionLabel>Linked bank</SectionLabel>
        <Card>
          <ListRow icon="bank" label={bank} value="Test" onPress={() => router.push('/settings/bank')} last />
        </Card>
        <View style={styles.trust}>
          <Icon name="shield" size={14} color={colors.textSecondary} />
          <Text variant="caption" color="textSecondary">
            Test money only · Face ID or PIN on every payment
          </Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

/** Money in vs out this month, with a flat split bar (green only for money received). */
function MonthTile({ label, inCents, outCents, hidden }: { label: string; inCents: number; outCents: number; hidden: boolean }) {
  const { colors } = useTheme();
  const total = inCents + outCents;
  const share = total ? inCents / total : 0.5;
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(withTiming(share, smooth(700)));
  }, [share, w]);
  const inBar = useAnimatedStyle(() => ({ flex: Math.max(0.02, w.value) }));
  const outBar = useAnimatedStyle(() => ({ flex: Math.max(0.02, 1 - w.value) }));
  const money = (c: number) => (hidden ? '••••' : formatShort(c));
  return (
    <View
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={`${label}: in ${hidden ? 'hidden' : formatCents(inCents)}, out ${hidden ? 'hidden' : formatCents(outCents)}`}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <View style={styles.tileRow}>
        <View>
          <Text style={[styles.tileNum, { color: colors.successText }]}>+{money(inCents)}</Text>
          <Text variant="caption" color="textSecondary">
            In
          </Text>
        </View>
        <View style={styles.alignEnd}>
          <Text style={[styles.tileNum, { color: colors.text }]}>−{money(outCents)}</Text>
          <Text variant="caption" color="textSecondary">
            Out
          </Text>
        </View>
      </View>
      <View style={styles.split}>
        <Animated.View style={[styles.bar, { backgroundColor: colors.success }, inBar]} />
        <Animated.View style={[styles.bar, { backgroundColor: colors.accent }, outBar]} />
      </View>
    </View>
  );
}

/** How much of today's $500 sending limit is used. */
function LimitTile({ sent, limit }: { sent: number; limit: number }) {
  const { colors } = useTheme();
  const used = Math.min(1, sent / limit);
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(withTiming(used, smooth(700)));
  }, [used, w]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(2, w.value * 100)}%` }));
  return (
    <View
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={`Sent in the last 24 hours: ${formatShort(sent)} of ${formatShort(limit)}`}>
      <Text variant="caption" color="textSecondary">
        Daily limit
      </Text>
      <Text style={[styles.tileNum, { color: colors.text }]}>{formatShort(sent)}</Text>
      <Text variant="caption" color="textSecondary">
        of {formatShort(limit)} · 24 hours
      </Text>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.accent }, fill]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginRight: -10 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22, paddingHorizontal: 4 },
  action: { alignItems: 'center', gap: 6, minWidth: MIN_TAP + 20 },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiles: { flexDirection: 'row', gap: 12, marginTop: 24 },
  tile: { flex: 1, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 4 },
  tileRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  alignEnd: { alignItems: 'flex-end' },
  tileNum: { fontFamily: Fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  split: { flexDirection: 'row', gap: 3, height: 6, marginTop: 8 },
  bar: { height: 6, borderRadius: 3 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  fill: { height: 6, borderRadius: 3 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  seeAll: { minHeight: MIN_TAP, minWidth: MIN_TAP, justifyContent: 'flex-end', alignItems: 'flex-end', paddingBottom: 10 },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginLeft: 4 },
});
