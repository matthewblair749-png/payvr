import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import { useTheme } from '@/theme/theme-provider';

/** One smooth swing: tip down toward the other phone, then back up. */
const HALF = 1100;

/** A simple phone outline with a notch and home bar. */
function PhoneGlyph({ height, color }: { height: number; color: string }) {
  return (
    <Svg width={height * 0.56} height={height} viewBox="0 0 56 100" fill="none">
      <Rect x="3" y="3" width="50" height="94" rx="12" stroke={color} strokeWidth="5" />
      <Rect x="20" y="10" width="16" height="5" rx="2.5" fill={color} />
      <Rect x="21" y="86" width="14" height="3.5" rx="1.75" fill={color} />
    </Svg>
  );
}

/**
 * A blue circle with a phone that smoothly tips down and back up, like pointing it at the
 * other phone. Still when Reduce Motion is on.
 */
export function TappingPhone({ size = 132, active = true }: { size?: number; active?: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  const animate = active && !reduceMotion;

  useEffect(() => {
    const ease = Easing.inOut(Easing.sin);
    if (!animate) {
      cancelAnimation(t);
      t.value = withTiming(0, { duration: 300, easing: ease });
      return;
    }
    t.value = withRepeat(withSequence(withTiming(1, { duration: HALF, easing: ease }), withTiming(0, { duration: HALF, easing: ease })), -1);
    return () => cancelAnimation(t);
  }, [animate, t]);

  const phoneStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 420 }, { translateY: t.value * size * 0.06 }, { rotateX: `${t.value * 42}deg` }],
  }));

  return (
    <View
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primary,
          boxShadow: `0 0 ${Math.round(size * 0.4)}px ${Math.round(size * 0.06)}px ${colors.primary}66`,
        },
      ]}>
      <Animated.View style={phoneStyle}>
        <PhoneGlyph height={size * 0.46} color={colors.onPrimary} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  orb: { alignItems: 'center', justifyContent: 'center' },
});
