import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { ChatButton } from '@/components/chat-button';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Keypad } from '@/components/keypad';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import type { TapMode } from '@/data/types';
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
  const { me, balanceCents, transactions, sentTodayCents, setDraft } = useApp();
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

  const pickPerson = (mode: TapMode) => {
    if (!ready(mode)) return;
    haptics.tap();
    router.push({ pathname: '/people', params: { mode, amount: String(cents) } });
  };

  // The raised Tap button in the tab bar sends the typed amount by tapping phones.
  // With nothing typed, it falls through to the amount screen (send or request).
  useFocusEffect(
    useCallback(
      () =>
        setTapHandler(() => {
          if (cents === 0) return false;
          if (sendError) {
            setHint(sendError);
            shakeNo(shake);
          } else {
            setDraft({ mode: 'send', amountCents: cents, note: '' });
            router.push('/tap');
          }
          return true;
        }),
      [cents, sendError, setDraft, shake],
    ),
  );

  const size = amount.length > 8 ? 64 : amount.length > 6 ? 76 : 92;
  const error = cents > 0 && sendError;

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 6 }]}>
      <View style={styles.top}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Balance ${formatCents(balanceCents)}. Opens your wallet`}
          onPress={() => {
            haptics.tap();
            router.navigate('/wallet');
          }}
          style={({ pressed }) => [
            styles.balance,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}>
          <Icon name="wallet" size={18} color={colors.accent} />
          <Text variant="amount">{formatCents(shownBalance)}</Text>
        </PressableScale>
        <View style={styles.topRight}>
          <ChatButton />
          <IconButton icon="qr" label="Scan or show a QR code" onPress={() => router.push('/qr')} />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            hitSlop={4}
            onPress={() => router.navigate('/profile')}
            style={({ pressed }) => [styles.me, { opacity: pressed ? 0.8 : 1 }]}>
            <Avatar name={me.name} uri={me.avatarUrl} size={40} />
          </PressableScale>
        </View>
      </View>

      {pending.length ? (
        <PressableScale
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
        </PressableScale>
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
      </View>

      <View style={styles.pad}>
        <Keypad onKey={press} />
      </View>

      <View style={styles.actions}>
        <PillButton label="Request" onPress={() => pickPerson('request')} />
        <PillButton label="Pay" onPress={() => pickPerson('send')} />
      </View>
    </View>
  );
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

function PillButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.95}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}>
      <Text variant="button">{label}</Text>
    </PressableScale>
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
