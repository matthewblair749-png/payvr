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

/** One full tap: lift, hover, dip down onto the other phone, settle. */
const LIFT = 520;
const HOVER = 260;
const DIP = 150;
const SETTLE = 270;

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
 * The glowing blue orb on the Tap screen, with a phone that bobs up and taps down as if
 * touching another phone. Each tap sends out a quick flash ring. Still when Reduce Motion is on.
 */
export function TappingPhone({ size = 132, active = true }: { size?: number; active?: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  const tilt = useSharedValue(0);
  const flash = useSharedValue(0);
  const animate = active && !reduceMotion;

  useEffect(() => {
    if (!animate) {
      cancelAnimation(y);
      cancelAnimation(tilt);
      cancelAnimation(flash);
      y.value = withTiming(0, { duration: 200 });
      tilt.value = withTiming(0, { duration: 200 });
      flash.value = 0;
      return;
    }
    const lift = Easing.bezier(0.22, 1, 0.36, 1);
    const dip = Easing.in(Easing.cubic);
    const up = -size * 0.14;
    y.value = withRepeat(
      withSequence(
        withTiming(up, { duration: LIFT, easing: lift }),
        withTiming(up, { duration: HOVER }),
        withTiming(size * 0.03, { duration: DIP, easing: dip }),
        withTiming(0, { duration: SETTLE, easing: lift }),
      ),
      -1,
    );
    // A slight forward lean on the way down, like reaching toward the other phone.
    tilt.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: LIFT, easing: lift }),
        withTiming(-6, { duration: HOVER }),
        withTiming(2, { duration: DIP, easing: dip }),
        withTiming(0, { duration: SETTLE, easing: lift }),
      ),
      -1,
    );
    // The flash fires the instant the phone touches down.
    flash.value = withRepeat(
      withSequence(
        withTiming(0, { duration: LIFT + HOVER + DIP }),
        withTiming(1, { duration: 0 }),
        withTiming(0, { duration: SETTLE + 280, easing: Easing.out(Easing.cubic) }),
      ),
      -1,
    );
    return () => {
      cancelAnimation(y);
      cancelAnimation(tilt);
      cancelAnimation(flash);
    };
  }, [animate, size, y, tilt, flash]);

  const phoneStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${tilt.value}deg` }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value * 0.7,
    transform: [{ scale: 1 + (1 - flash.value) * 0.35 }],
  }));
  // The orb swells a touch on each tap.
  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + flash.value * 0.04 }] }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          styles.flash,
          { width: size, height: size, borderRadius: size / 2, borderColor: colors.onPrimary },
          flashStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.primary,
            boxShadow: `0 0 ${Math.round(size * 0.45)}px ${Math.round(size * 0.12)}px ${colors.primary}99`,
          },
          orbStyle,
        ]}>
        <Animated.View style={phoneStyle}>
          <PhoneGlyph size={size * 0.46} color={colors.onPrimary} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  orb: { alignItems: 'center', justifyContent: 'center' },
  flash: { position: 'absolute', borderWidth: 3, pointerEvents: 'none' },
});
