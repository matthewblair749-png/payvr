import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-provider';
import { Fonts } from '@/theme/typography';

import { Avatar } from '../avatar';
import { Icon } from '../icon';
import { PayvrLogo } from '../payvr-logo';
import { Text } from '../text';

/** One loop of the story, in ms: phones meet, money moves, it lands, they part. */
const LOOP = 4800;
/** Where the loop rests when motion is off: the money has just landed. */
const STILL = 0.66;

/** 0→1 across [a, b] with a smooth ease-in-out (no overshoot). */
function seg(t: number, a: number, b: number) {
  'worklet';
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
/** 0→1→0: in across [a, b], out across [c, d]. */
function hold(t: number, a: number, b: number, c: number, d: number) {
  'worklet';
  return seg(t, a, b) - seg(t, c, d);
}

const PHONE_W = 108;
const APART = 92;
const TOUCH = 56;

/** A phone glides in (tilted), straightens as they touch, then drifts back out. */
function phoneMotion(t: number, side: -1 | 1) {
  'worklet';
  const meet = hold(t, 0.04, 0.24, 0.86, 1);
  const x = side * (APART - (APART - TOUCH) * meet);
  return { transform: [{ translateX: x }, { rotate: `${side * 7 * (1 - meet)}deg` }] };
}

/**
 * The first thing people see: two phones glide together, rings ripple where they touch,
 * "$20" hops across, and it lands on the other phone as "+$20". Then they part and it loops.
 */
export function TapScene({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(STILL);

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(t);
      t.set(STILL);
      return;
    }
    t.set(0);
    t.set(withRepeat(withTiming(1, { duration: LOOP, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [active, reduceMotion, t]);

  const left = useAnimatedStyle(() => phoneMotion(t.value, -1));
  const right = useAnimatedStyle(() => phoneMotion(t.value, 1));

  const bond = useAnimatedStyle(() => {
    const v = hold(t.value, 0.2, 0.3, 0.8, 0.9);
    return { opacity: v, transform: [{ scale: 0.6 + 0.4 * v }] };
  });

  const coin = useAnimatedStyle(() => {
    const f = seg(t.value, 0.3, 0.5);
    const shown = hold(t.value, 0.29, 0.33, 0.47, 0.52);
    return {
      opacity: shown,
      transform: [{ translateX: -TOUCH + 2 * TOUCH * f }, { translateY: -64 - 26 * Math.sin(Math.PI * f) }],
    };
  });

  const sent = useAnimatedStyle(() => ({ opacity: hold(t.value, 0.48, 0.56, 0.88, 0.97) }));
  const sending = useAnimatedStyle(() => ({ opacity: 1 - hold(t.value, 0.48, 0.56, 0.88, 0.97) }));
  const got = useAnimatedStyle(() => {
    const v = hold(t.value, 0.5, 0.6, 0.88, 0.97);
    return { opacity: v, transform: [{ translateY: 6 * (1 - v) }] };
  });
  const waiting = useAnimatedStyle(() => ({ opacity: 1 - hold(t.value, 0.5, 0.6, 0.88, 0.97) }));

  return (
    <View style={styles.stage} accessible accessibilityLabel="Two phones tap together and $20 moves from one to the other">
      <Ripple t={t} delay={0} color={colors.primary} />
      <Ripple t={t} delay={0.08} color={colors.primary} />

      {/* Your phone: sending $20 */}
      <Animated.View style={[styles.phone, { backgroundColor: colors.surface, borderColor: colors.border }, left]}>
        <View style={[styles.notch, { backgroundColor: colors.border }]} />
        <Avatar name="Matthew Cooper" size={34} />
        <Text style={[styles.amount, { color: colors.text }]}>$20</Text>
        <View style={styles.captionSlot}>
          <Animated.View style={[styles.caption, sending]}>
            <Text variant="caption" color="textSecondary">
              Sending…
            </Text>
          </Animated.View>
          <Animated.View style={[styles.caption, sent]}>
            <Icon name="check" size={13} color={colors.accent} strokeWidth={3} />
            <Text variant="caption" color="accent">
              Sent
            </Text>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Their phone: receives it */}
      <Animated.View style={[styles.phone, { backgroundColor: colors.surface, borderColor: colors.border }, right]}>
        <View style={[styles.notch, { backgroundColor: colors.border }]} />
        <Avatar name="Jake Rivera" size={34} />
        <View style={styles.amountSlot}>
          <Animated.View style={[styles.center, waiting]}>
            <Text style={[styles.amount, { color: colors.textSecondary }]}>$0</Text>
          </Animated.View>
          <Animated.View style={[styles.center, styles.overlay, got]}>
            <Text style={[styles.amount, { color: colors.success }]}>+$20</Text>
          </Animated.View>
        </View>
        <View style={styles.captionSlot}>
          <Animated.View style={[styles.caption, waiting]}>
            <Text variant="caption" color="textSecondary">
              Ready
            </Text>
          </Animated.View>
          <Animated.View style={[styles.caption, got]}>
            <Text variant="caption" color="successText">
              from Matthew
            </Text>
          </Animated.View>
        </View>
      </Animated.View>

      {/* The p where they meet */}
      <Animated.View style={[styles.bond, { backgroundColor: colors.primary, borderColor: colors.background }, bond]}>
        <PayvrLogo size={26} color="#FFFFFF" cutColor={colors.primary} />
      </Animated.View>

      {/* $20 hopping across */}
      <Animated.View style={[styles.coin, { backgroundColor: colors.primary }, coin]}>
        <Text style={styles.coinText}>$20</Text>
      </Animated.View>
    </View>
  );
}

function Ripple({ t, delay, color }: { t: SharedValue<number>; delay: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const r = seg(t.value, 0.24 + delay, 0.62 + delay);
    const on = t.value > 0.24 + delay && t.value < 0.62 + delay;
    return { opacity: on ? 0.75 * (1 - r) : 0, transform: [{ scale: 0.3 + 2.2 * r }] };
  });
  return <Animated.View style={[styles.ripple, { borderColor: color }, style]} />;
}

const styles = StyleSheet.create({
  // Drawn at a comfortable size, then scaled up to fill the space above the headline.
  stage: { width: 320, height: 250, alignItems: 'center', justifyContent: 'center', transform: [{ scale: 1.18 }] },
  phone: {
    position: 'absolute',
    width: PHONE_W,
    height: 196,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    paddingTop: 12,
    gap: 10,
  },
  notch: { width: 34, height: 5, borderRadius: 3, marginBottom: 6 },
  amount: { fontFamily: Fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  amountSlot: { height: 34, alignSelf: 'stretch' },
  center: { alignItems: 'center' },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0 },
  captionSlot: { height: 18, alignSelf: 'stretch' },
  caption: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  bond: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 3 },
  coin: { position: 'absolute', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  coinText: { color: '#FFFFFF', fontFamily: Fonts.bold, fontSize: 14, lineHeight: 18 },
});
