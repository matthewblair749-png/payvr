import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Keypad } from '@/components/keypad';
import { Text } from '@/components/text';
import type { TapMode, User } from '@/data/types';
import { useCountUp } from '@/hooks/use-count-up';
import { DAILY_SEND_LIMIT_CENTS } from '@/services/payments';
import { describe, useApp } from '@/store/app-store';
import { setTapHandler } from '@/store/tap-intent';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { applyKey, displayTyped, formatCents, formatShort, toCents } from '@/utils/money';

/**
 * Keypad first: type an amount, then Request, Pay (pick a person), or Tap (hold phones together).
 * The balance sits small at the top and opens the Wallet.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { me, balanceCents, transactions, sentTodayCents, setDraft, contacts, userById } = useApp();
  const recent = useMemo(
    () =>
      contacts
        .map((c) => userById(c.userId))
        .filter((u): u is User => !!u && u.id !== me.id)
        .slice(0, 5),
    [contacts, userById, me.id],
  );
  const shownBalance = useCountUp(balanceCents);
  const [amount, setAmount] = useState('0');
  const [hint, setHint] = useState<string | null>(null);
  const cents = toCents(amount);
  const pending = transactions.filter((t) => describe(t, me.id).needsMyAction);

  const leftToday = DAILY_SEND_LIMIT_CENTS - sentTodayCents;
  const sendError =
    cents > balanceCents
      ? 'More than your balance'
      : cents > leftToday
        ? `Daily limit · ${formatShort(Math.max(0, leftToday))} left today`
        : null;

  // Keypad pop: the number bumps on every key and shakes when something's wrong.
  const bump = useSharedValue(1);
  const shake = useSharedValue(0);
  const amountStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }, { translateX: shake.value }] }));
  const nudge = () => shakeNo(shake);

  const press = (key: string) => {
    setHint(null);
    const next = applyKey(amount, key);
    if (next === amount && key !== 'back') {
      nudge();
      return;
    }
    setAmount(next);
    bump.set(withSequence(withTiming(1.06, { duration: 55 }), withSpring(1, { damping: 11, stiffness: 280 })));
  };

  const ready = (mode: TapMode) => {
    if (cents === 0) {
      setHint('Type an amount first');
      nudge();
      return false;
    }
    if (mode === 'send' && sendError) {
      setHint(sendError);
      nudge();
      return false;
    }
    return true;
  };

  // One tap on a recent face: straight to the send screen with the typed amount.
  const quickPay = (u: User) => {
    if (!ready('send')) return;
    haptics.tap();
    setDraft({ mode: 'send', amountCents: cents, note: '', peerId: u.id });
    router.push('/confirm');
  };

  const pickPerson = (mode: TapMode) => {
    if (!ready(mode)) return;
    haptics.tap();
    router.push({ pathname: '/people', params: { mode, amount: String(cents) } });
  };

  // The raised Tap button in the tab bar sends the typed amount by tapping phones.
  // With nothing typed, it falls through to the amount screen (send or request).
  const onTab = () => {
    if (cents === 0) return false;
    if (sendError) {
      setHint(sendError);
      nudge();
    } else {
      setDraft({ mode: 'send', amountCents: cents, note: '' });
      router.push('/tap');
    }
    return true;
  };

  const size = amount.length > 8 ? 64 : amount.length > 6 ? 76 : 92;
  const error = cents > 0 && sendError;

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 6 }]}>
      <TapTabHandler onPress={onTab} />
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Balance ${formatCents(balanceCents)}. Opens your wallet`}
          onPress={() => {
            haptics.tap();
            router.navigate('/wallet');
          }}
          style={({ pressed }) => [
            styles.balance,
            { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ scale: pressed ? 0.96 : 1 }] },
          ]}>
          <Icon name="wallet" size={18} color={colors.accent} />
          <Text variant="amount">{formatCents(shownBalance)}</Text>
        </Pressable>
        <View style={styles.wordmarkWrap}>
          <Text style={[styles.wordmark, { color: colors.text }]} accessibilityRole="header">
            payvr
          </Text>
        </View>
        <View style={styles.topRight}>
          <IconButton icon="qr" label="Scan or show a QR code" onPress={() => router.push('/qr')} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            hitSlop={4}
            onPress={() => router.navigate('/profile')}
            style={({ pressed }) => [styles.me, { opacity: pressed ? 0.7 : 1 }]}>
            <Avatar name={me.name} uri={me.avatarUrl} size={40} />
          </Pressable>
        </View>
      </View>

      {pending.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${pending.length} ${pending.length === 1 ? 'request' : 'requests'} waiting for you`}
          onPress={() => {
            haptics.tap();
            if (pending.length === 1) router.push({ pathname: '/request/[id]', params: { id: pending[0].id } });
            else router.navigate('/feed');
          }}
          style={[styles.pending, { borderColor: colors.accent }]}>
          <View style={[styles.dot, { backgroundColor: colors.accent }]} />
          <Text variant="caption" color="accent">
            {pending.length === 1 ? '1 request waiting' : `${pending.length} requests waiting`}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.pendingSpace} />
      )}

      <View style={styles.display}>
        <Animated.View style={amountStyle}>
          <Text
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Amount ${displayTyped(amount)}`}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              fontFamily: Fonts.bold,
              fontSize: size,
              lineHeight: size * 1.08,
              letterSpacing: -size * 0.045,
              fontVariant: ['tabular-nums'],
              color: error ? colors.error : cents === 0 ? colors.textSecondary : colors.text,
            }}>
            {displayTyped(amount)}
          </Text>
        </Animated.View>
        <Text variant="small" color={hint || error ? 'error' : 'textSecondary'} style={styles.hint} accessibilityLiveRegion="polite">
          {hint ?? (error || (cents ? 'Tap phones to send · or pick someone' : 'Type an amount'))}
        </Text>
        {recent.length ? (
          <View style={styles.quick} accessibilityLabel="Quick pay">
            {recent.map((u) => (
              <Pressable
                key={u.id}
                accessibilityRole="button"
                accessibilityLabel={`Pay ${u.name}`}
                onPress={() => quickPay(u)}
                style={({ pressed }) => [styles.quickItem, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
                <Avatar name={u.name} uri={u.avatarUrl} size={44} />
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {u.name.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.pad}>
        <Keypad onKey={press} />
      </View>

      <View style={styles.actions}>
        <PillButton label="Request" onPress={() => pickPerson('request')} />
        <PillButton label="Pay" primary onPress={() => pickPerson('send')} />
      </View>
    </View>
  );
}

/** While Home is focused, the tab bar's Tap button runs `onPress` (see store/tap-intent). */
function TapTabHandler({ onPress }: { onPress: () => boolean }) {
  useFocusEffect(useCallback(() => setTapHandler(onPress), [onPress]));
  return null;
}

function shakeNo(shake: SharedValue<number>) {
  haptics.error();
  shake.set(
    withSequence(
      withTiming(-10, { duration: 45 }),
      withTiming(10, { duration: 45 }),
      withTiming(-6, { duration: 45 }),
      withTiming(0, { duration: 45 }),
    ),
  );
}

function PillButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: primary ? colors.primary : colors.surface,
          borderColor: primary ? colors.primary : colors.border,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
      ]}>
      <Text variant="button" style={primary ? { color: colors.onPrimary } : undefined}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 52 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: MIN_TAP,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pending: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: MIN_TAP,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 6,
  },
  pendingSpace: { height: 50 },
  me: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  display: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 4, minHeight: 130 },
  // Centered on the screen, not between the balance pill and the buttons.
  wordmarkWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  wordmark: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -1,
  },
  quick: { flexDirection: 'row', gap: 14, marginTop: 18 },
  quickItem: { alignItems: 'center', gap: 4, width: 52 },
  hint: { minHeight: 20 },
  pad: { paddingHorizontal: 20 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 12,
  },
  pill: {
    flex: 1,
    height: 56,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
