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
import { setStatusBarStyle } from 'expo-status-bar';

import { Avatar } from '@/components/avatar';
import { ChatButton } from '@/components/chat-button';
import { Icon, type IconName } from '@/components/icon';
import { Keypad } from '@/components/keypad';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import type { TapMode } from '@/data/types';
import { useCountUp } from '@/hooks/use-count-up';
import { useAccount } from '@/store/account';
import { describe, useApp } from '@/store/app-store';
import { useCards } from '@/store/cards-store';
import { setTapHandler } from '@/store/tap-intent';
import { BRAND_BLUE } from '@/theme/colors';
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
  const { me, balanceCents, transactions, sentTodayCents, setDraft, userById } = useApp();
  const { dailyLimitCents } = useAccount();
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

  const leftToday = dailyLimitCents - sentTodayCents;
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

  const size = amount.length > 8 ? 72 : amount.length > 6 ? 88 : 108;
  const error = cents > 0 && sendError;

  return (
    <View style={[styles.fill, { backgroundColor: BRAND_BLUE, paddingTop: insets.top + 6 }]}>
      <LightStatusBar />
      <View style={styles.top}>
        <View style={styles.topLeft}>
          <ChatButton onBrand />
          <RoundButton icon="qr" label="Scan or show a QR code" onPress={() => router.push('/qr')} />
        </View>
        <PressableScale
          scaleTo={0.94}
          accessibilityRole="button"
          accessibilityLabel={`${greeting}, ${first}. Your profile`}
          onPress={() => router.navigate('/profile')}
          style={styles.avatarTap}>
          <View style={styles.avatarRing}>
            <Avatar name={me.name} uri={me.avatarUrl} size={38} />
          </View>
        </PressableScale>
      </View>

      {request ? (
        <Animated.View entering={FadeInDown.duration(380).easing(EASE)} style={styles.requestWrap}>
          <PressableScale
            scaleTo={0.98}
            haptic="tap"
            accessibilityRole="button"
            accessibilityLabel={`${requester?.name ?? 'Someone'} requested ${formatShort(request.amountCents)}${request.note ? ` for ${request.note}` : ''}. Open`}
            onPress={() => router.push({ pathname: '/request/[id]', params: { id: request.id } })}
            style={styles.request}>
            <Avatar name={requester?.name ?? '?'} uri={requester?.avatarUrl} size={36} />
            <View style={styles.flex}>
              <Text variant="bodyMedium" numberOfLines={1} style={styles.white}>
                {requester?.name.split(' ')[0] ?? 'Someone'} requested {formatShort(request.amountCents)}
              </Text>
              <Text variant="caption" numberOfLines={1} style={styles.soft}>
                {request.note || 'Payment request'}
                {pending.length > 1 ? ` · +${pending.length - 1} more` : ''}
              </Text>
            </View>
            <View style={styles.payChip}>
              <Text variant="caption" style={styles.blueText}>
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
              letterSpacing: -size * 0.05,
              fontVariant: ['tabular-nums'],
              color: '#FFFFFF',
              opacity: cents === 0 ? 0.55 : 1,
            }}>
            {displayTyped(amount)}
          </Text>
        </Animated.View>
        {hint || error ? (
          <View style={styles.warn} accessibilityLiveRegion="polite">
            <Icon name="close" size={14} color="#FFFFFF" strokeWidth={3} />
            <Text variant="small" style={styles.white}>
              {hint ?? error}
            </Text>
          </View>
        ) : (
          <PressableScale
            scaleTo={0.96}
            haptic="tap"
            accessibilityRole="button"
            accessibilityLabel={`Pay with ${payWith}. Opens your wallet`}
            onPress={() => router.navigate('/wallet')}
            style={styles.source}>
            <Icon name={defaultSource === 'balance' ? 'wallet' : 'card'} size={16} color="#FFFFFF" />
            <Text variant="caption" style={styles.white}>
              {payWith}
            </Text>
            <Icon name="chevronRight" size={14} color="#FFFFFF" />
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
                style={styles.quickChip}>
                <Text variant="bodyMedium" style={styles.white}>
                  {formatShort(c)}
                </Text>
              </PressableScale>
            ))}
          </View>
        ) : (
          <View style={styles.quickSpace}>
            <Text variant="caption" align="center" style={styles.soft}>
              Hold phones together to send · or tap Pay
            </Text>
          </View>
        )}
      </View>

      <View style={styles.pad}>
        <Keypad onKey={press} color="#FFFFFF" pressedColor="rgba(255,255,255,0.14)" />
      </View>

      <View style={styles.actions}>
        <PillButton label="Request" onPress={() => pickPerson('request')} />
        <PillButton label="Pay" primary onPress={() => pickPerson('send')} />
      </View>
    </View>
  );
}

/** White status-bar text while Home (blue) is on screen; the theme's style everywhere else. */
function LightStatusBar() {
  const { scheme } = useTheme();
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
    }, [scheme]),
  );
  return null;
}

/** A white glyph in a see-through white circle, like Cash App's top buttons. */
function RoundButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressableScale
      scaleTo={0.9}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.round, { opacity: pressed ? 0.75 : 1 }]}>
      <Icon name={icon} size={22} color="#FFFFFF" />
    </PressableScale>
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

/** Request: see-through white pill. Pay: solid black pill, the strongest thing on the screen. */
function PillButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <PressableScale
      scaleTo={0.95}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.pill, primary ? styles.pillPay : styles.pillSoft]}>
      <Text variant="button" style={styles.white}>
        {label}
      </Text>
    </PressableScale>
  );
}

// Colors on the blue Home screen (white on #2150FF is 5.9:1; 85% white still passes AA for small text).
const SEE_THROUGH = 'rgba(255,255,255,0.18)';

const styles = StyleSheet.create({
  fill: { flex: 1 },
  white: { color: '#FFFFFF' },
  soft: { color: 'rgba(255,255,255,0.85)' },
  blueText: { color: BRAND_BLUE },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 52 },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: { width: MIN_TAP, height: MIN_TAP, borderRadius: MIN_TAP / 2, backgroundColor: SEE_THROUGH, alignItems: 'center', justifyContent: 'center' },
  avatarTap: { minWidth: MIN_TAP, minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  avatarRing: { borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', padding: 1 },
  flex: { flex: 1, minWidth: 0 },
  requestWrap: { paddingHorizontal: 16, marginTop: 6 },
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 20,
    backgroundColor: SEE_THROUGH,
  },
  payChip: {
    minHeight: 36,
    minWidth: 56,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  requestSpace: { height: 66 },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TAP,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: SEE_THROUGH,
    marginTop: 6,
  },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TAP,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,10,0.35)',
    marginTop: 6,
  },
  quick: { flexDirection: 'row', gap: 8, marginTop: 16 },
  quickChip: {
    minHeight: MIN_TAP,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: SEE_THROUGH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickSpace: { height: MIN_TAP + 16, justifyContent: 'center' },
  display: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 4, minHeight: 130 },
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
  pill: { flex: 1, height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pillSoft: { backgroundColor: SEE_THROUGH },
  pillPay: { backgroundColor: '#0A0A0A' },
});
