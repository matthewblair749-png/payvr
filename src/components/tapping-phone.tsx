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

/** One smooth swing: tilt down toward the other phone, then back up. */
const HALF = 1100;

/** A phone outline, like the Tap button's glyph but drawn bigger. */
function PhoneGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size * 0.62} height={size} viewBox="0 0 31 50" fill="none">
      <Rect x="2" y="2" width="27" height="46" rx="6.5" stroke={color} strokeWidth="3.2" />
      <Rect x="11" y="6.5" width="9" height="3.2" rx="1.6" fill={color} />
      <Rect x="12" y="41" width="7" height="2.4" rx="1.2" fill={color} />
    </Svg>
  );
}

/**
 * The glowing blue orb on the Tap screen, with a phone that smoothly tips down and back up,
 * like pointing your phone at the other one. The glow brightens gently as it points down.
 * Still when Reduce Motion is on.
 */
export function TappingPhone({ size = 132, active = true }: { size?: number; active?: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  // 0 = upright, 1 = pointing down.
  const t = useSharedValue(0);
  const animate = active && !reduceMotion;

  useEffect(() => {
    if (!animate) {
      cancelAnimation(t);
      t.value = withTiming(0, { duration: 300, easing: Easing.inOut(Easing.sin) });
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    t.value = withRepeat(withSequence(withTiming(1, { duration: HALF, easing: ease }), withTiming(0, { duration: HALF, easing: ease })), -1);
    return () => cancelAnimation(t);
  }, [animate, t]);

  const phoneStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 400 },
      { translateY: t.value * size * 0.06 },
      // Top tips away from you, so the phone points down.
      { rotateX: `${t.value * 42}deg` },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + t.value * 0.35,
    transform: [{ scale: 1 + t.value * 0.08 }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          styles.glow,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.primary,
            boxShadow: `0 0 ${Math.round(size * 0.6)}px ${Math.round(size * 0.22)}px ${colors.primary}`,
          },
          glowStyle,
        ]}
      />
      <View
        style={[
          styles.orb,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.primary,
            boxShadow: `0 0 ${Math.round(size * 0.45)}px ${Math.round(size * 0.12)}px ${colors.primary}99`,
          },
        ]}>
        <Animated.View style={phoneStyle}>
          <PhoneGlyph size={size * 0.46} color={colors.onPrimary} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  orb: { alignItems: 'center', justifyContent: 'center' },
  // Extra halo behind the orb that brightens as the phone points down.
  glow: { position: 'absolute', pointerEvents: 'none' },
});
