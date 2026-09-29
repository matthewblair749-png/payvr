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

const DURATION = 2400;

function Ring({ delay, size, active, index, spread }: { delay: number; size: number; active: boolean; index: number; spread: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      // Reduce Motion: still rings instead of ripples.
      t.value = active ? (index + 1) / 3.5 : 0;
      return;
    }
    if (active) {
      t.value = 0;
      t.value = withDelay(delay, withRepeat(withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) }), -1, false));
    } else {
      cancelAnimation(t);
      t.value = withTiming(0, { duration: 300 });
    }
    return () => cancelAnimation(t);
  }, [active, delay, t, reduceMotion, index]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - t.value),
    transform: [{ scale: 1 + t.value * spread }],
  }));

  return (
    <Animated.View
      style={[{ pointerEvents: 'none' }, 
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor: colors.ring },
        style,
      ]}
    />
  );
}

/** Blue rings rippling outward from the center, looping while `active`. `spread` = how far they travel. */
export function PulseRings({
  size,
  active = true,
  spread = 1.6,
  children,
}: {
  size: number;
  active?: boolean;
  spread?: number;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.wrap, { width: size * (1 + spread) * 1.08, height: size * (1 + spread) * 1.08 }]}>
      {[0, DURATION / 3, (DURATION * 2) / 3].map((d, i) => (
        <Ring key={d} delay={d} size={size} active={active} index={i} spread={spread} />
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
});
