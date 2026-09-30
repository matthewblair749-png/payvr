import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-provider';
import { smooth } from '@/utils/motion';

import { Avatar } from '../avatar';
import { Icon } from '../icon';
import { PulseRings } from '../pulse-rings';
import { Text } from '../text';

/** Their face and name rise into view before anything moves, then "Swipe up to send". */
export function FoundScene({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const rise = useSharedValue(reduceMotion ? 1 : 0);
  const pill = useSharedValue(reduceMotion ? 1 : 0);
  const hint = useSharedValue(1);

  useEffect(() => {
    if (!active || reduceMotion) return;
    rise.set(0);
    pill.set(0);
    rise.set(withTiming(1, smooth(700)));
    pill.set(withDelay(650, withTiming(1, smooth(600))));
    hint.set(withRepeat(withTiming(0.35, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(hint);
  }, [active, reduceMotion, rise, pill, hint]);

  const card = useAnimatedStyle(() => ({ opacity: rise.value, transform: [{ translateY: 28 * (1 - rise.value) }] }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: pill.value, transform: [{ translateY: 14 * (1 - pill.value) }] }));
  const chevron = useAnimatedStyle(() => ({ opacity: hint.value }));

  return (
    <Animated.View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, card]}
      accessible
      accessibilityLabel="Jake Rivera, @jake, right next to you. Swipe up to send.">
      <PulseRings size={76} spread={1.1} active={active && !reduceMotion}>
        <Avatar name="Jake Rivera" size={76} ring />
      </PulseRings>
      <Text variant="heading" style={styles.name}>
        Jake Rivera
      </Text>
      <Text variant="small" color="textSecondary">
        @jake · <Text variant="small" color="accent">right next to you</Text>
      </Text>
      <Animated.View style={[styles.pill, { backgroundColor: colors.primary }, pillStyle]}>
        <View style={[styles.knob, { backgroundColor: colors.onPrimary }]}>
          <Icon name="arrowUpRight" size={16} color={colors.primary} strokeWidth={2.6} />
        </View>
        <Text variant="bodyMedium" style={{ color: colors.onPrimary }}>
          Swipe up to send
        </Text>
        <Animated.View style={chevron}>
          <Icon name="chevronUp" size={16} color={colors.onPrimary} strokeWidth={2.6} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 290,
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: 18,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  name: { marginTop: -18 },
  pill: {
    marginTop: 16,
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingLeft: 52,
    paddingRight: 16,
  },
  knob: { position: 'absolute', left: 6, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
