import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { haptics } from '@/utils/haptics';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const CIRCLE_LEN = 2 * Math.PI * 44;
const CHECK_LEN = 60;

/** A circle then a checkmark draw themselves in, finishing with a small haptic bounce. */
export function CheckDraw({ size = 132, color }: { size?: number; color: string }) {
  const ring = useSharedValue(0);
  const check = useSharedValue(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 160 });
    ring.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
    check.value = withDelay(350, withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }));
    const t = setTimeout(() => {
      haptics.success();
      scale.value = withSequence(withTiming(1.08, { duration: 110 }), withSpring(1, { damping: 8 }));
    }, 700);
    return () => clearTimeout(t);
  }, [ring, check, scale]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRCLE_LEN * (1 - ring.value) }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - check.value) }));
  const wrap = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={wrap} accessibilityLabel="Success" accessibilityRole="image">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <AnimatedPath
          d="M50 6 a44 44 0 1 1 0 88 a44 44 0 1 1 0 -88"
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeDasharray={`${CIRCLE_LEN} ${CIRCLE_LEN}`}
          strokeLinecap="round"
          animatedProps={ringProps}
        />
        <AnimatedPath
          d="M31 51 L44 64 L70 37"
          stroke={color}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${CHECK_LEN} ${CHECK_LEN}`}
          animatedProps={checkProps}
        />
      </Svg>
    </Animated.View>
  );
}
