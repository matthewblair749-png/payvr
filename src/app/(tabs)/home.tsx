import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
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
import { useCards } from '@/store/cards-store';
import { setTapHandler } from '@/store/tap-intent';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { applyKey, displayTyped, formatCents, formatShort, toCents } from '@/utils/money';
import { EASE, smooth } from '@/utils/motion';

/**
 * Keypad first: type an amount, then Request, Pay (pick a person), or Tap (hold phones together).
 * The balance sits small at the top and opens the Wallet.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { me, balanceCents, transactions, sentTodayCents, setDraft, userById } = useApp();
  // With a card connected, amounts above the balance are fine: the card pays.
  const { cards, defaultSource, sourceLabel } = useCards();
  const canUseCard = cards.length > 0;
  const shownBalance = useCountUp(balanceCents);
  const first = me.name.split(' ')[0];
  const [greeting] = useState(greetingNow);
  const [amount, setAmount] = useState('0');
  const [hint, setHint] = useState<string | null>(null);
  const cents = toCents(amount);
  const pending = transactions.filter((t) => describe(t, me.id).needsMyAction);
  const request = pending[0];
  const requester = request ? userById(request.toUser) : undefined;
  const payWith = defaultSource === 'balance' ? `Balance ${formatCents(shownBalance)}` : `Pay with ${sourceLabel(defaultSource)}`;

  const leftToday = DAILY_SEND_LIMIT_CENTS - sentTodayCents;
  const sendError =
    cents > balanceCents && !canUseCard
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
    bump.set(withSequence(withTiming(1.03, smooth(70)), withTiming(1, smooth(200))));
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
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={`${greeting}, ${first}. Your profile`}
          onPress={() => router.navigate('/profile')}
          style={styles.hello}>
          <Avatar name={me.name} uri={me.avatarUrl} size={40} />
          <View>
            <Text variant="caption" color="textSecondary">
              {greeting}
            </Text>
            <Text variant="bodyMedium">{first}</Text>
          </View>
        </PressableScale>
        <View style={styles.topRight}>
          <ChatButton />
          <IconButton icon="qr" label="Scan or show a QR code" onPress={() => router.push('/qr')} />
        </View>
      </View>

      {request ? (
        <Animated.View entering={FadeInDown.duration(380).easing(EASE)} style={styles.requestWrap}>
          <PressableScale
            scaleTo={0.98}
            haptic="tap"
            accessibilityRole="button"
            accessibilityLabel={`${requester?.name ?? 'Someone'} requested ${formatShort(request.amountCents)}${request.note ? ` for ${request.note}` : ''}. Open`}
            onPress={() => router.push({ pathname: '/request/[id]', params: { id: request.id } })}
            style={[styles.request, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Avatar name={requester?.name ?? '?'} uri={requester?.avatarUrl} size={36} />
            <View style={styles.flex}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {requester?.name.split(' ')[0] ?? 'Someone'} requested {formatShort(request.amountCents)}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {request.note || 'Payment request'}
                {pending.length > 1 ? ` · +${pending.length - 1} more` : ''}
              </Text>
            </View>
            <View style={[styles.payChip, { backgroundColor: colors.primary }]}>
              <Text variant="caption" style={{ color: colors.onPrimary }}>
                Pay
              </Text>
            </View>
          </PressableScale>
        </Animated.View>
      ) : (
        <View style={styles.requestSpace} />
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
        {hint || error ? (
          <Text variant="small" color="error" style={styles.hint} accessibilityLiveRegion="polite">
            {hint ?? error}
          </Text>
        ) : (
          <PressableScale
            scaleTo={0.96}
            haptic="tap"
            accessibilityRole="button"
            accessibilityLabel={`Pay with ${payWith}. Opens your wallet`}
            onPress={() => router.navigate('/wallet')}
            style={[styles.source, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name={defaultSource === 'balance' ? 'wallet' : 'card'} size={16} color={colors.accent} />
            <Text variant="caption" color="textSecondary">
              {payWith}
            </Text>
            <Icon name="chevronRight" size={14} color={colors.textSecondary} />
          </PressableScale>
        )}
        {cents === 0 ? (
          <View style={styles.quick}>
            {QUICK.map((c) => (
              <PressableScale
                key={c}
                scaleTo={0.94}
                haptic="tap"
                accessibilityRole="button"
                accessibilityLabel={formatShort(c)}
                onPress={() => {
                  setHint(null);
                  setAmount(String(c / 100));
                }}
                style={[styles.quickChip, { borderColor: colors.border }]}>
                <Text variant="bodyMedium">{formatShort(c)}</Text>
              </PressableScale>
            ))}
          </View>
        ) : (
          <View style={styles.quickSpace}>
            <Text variant="caption" color="textSecondary" align="center">
              Hold phones together to send · or tap Pay
            </Text>
          </View>
        )}
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

const QUICK = [500, 1000, 2000, 5000];

function greetingNow() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
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
    <PressableScale
      scaleTo={0.95}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.pill,
        primary
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1.5 },
      ]}>
      <Text variant="button" style={primary ? { color: colors.onPrimary } : undefined}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 52 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  flex: { flex: 1, minWidth: 0 },
  hello: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TAP },
  requestWrap: { paddingHorizontal: 16, marginTop: 6 },
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  payChip: { minHeight: 36, minWidth: 56, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  requestSpace: { height: 66 },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TAP,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
  },
  quick: { flexDirection: 'row', gap: 8, marginTop: 16 },
  quickChip: {
    minHeight: MIN_TAP,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickSpace: { height: MIN_TAP + 16, justifyContent: 'center' },
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
