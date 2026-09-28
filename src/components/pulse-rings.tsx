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

function Ring({ delay, size, active, index }: { delay: number; size: number; active: boolean; index: number }) {
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
    transform: [{ scale: 1 + t.value * 1.6 }],
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

/** Blue rings rippling outward from the center, looping while `active`. */
export function PulseRings({ size, active = true, children }: { size: number; active?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.wrap, { width: size * 2.8, height: size * 2.8 }]}>
      {[0, DURATION / 3, (DURATION * 2) / 3].map((d, i) => (
        <Ring key={d} delay={d} size={size} active={active} index={i} />
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
});
