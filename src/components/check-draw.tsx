import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  useReducedMotion,
  type SharedValue,
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
  const burst = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 160 });
    ring.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
    check.value = withDelay(350, withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }));
    const t = setTimeout(() => {
      haptics.success();
      scale.value = withSequence(withTiming(1.08, { duration: 110 }), withSpring(1, { damping: 8 }));
      if (!reduceMotion) burst.value = withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) });
    }, 700);
    return () => clearTimeout(t);
  }, [ring, check, scale, burst, reduceMotion]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRCLE_LEN * (1 - ring.value) }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - check.value) }));
  const wrap = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={[styles.box, { width: size * 2, height: size * 2, marginVertical: -size / 2 }]} accessibilityLabel="Success" accessibilityRole="image">
      <Burst t={burst} size={size} color={color} />
    <Animated.View style={wrap}>
      <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]} />
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
    </View>
  );
}

const SPARKS = 10;

/** A ring and a circle of sparks flying out as the check lands. */
function Burst({ t, size, color }: { t: SharedValue<number>; size: number; color: string }) {
  const ringStyle = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 0.5 * (1 - t.value),
    transform: [{ scale: 1 + t.value * 0.7 }],
  }));
  return (
    <>
      <Animated.View
        style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }, ringStyle]}
      />
      {Array.from({ length: SPARKS }, (_, i) => (
        <Spark key={i} t={t} angle={(i / SPARKS) * Math.PI * 2} size={size} color={color} big={i % 2 === 0} />
      ))}
    </>
  );
}

function Spark({ t, angle, size, color, big }: { t: SharedValue<number>; angle: number; size: number; color: string; big: boolean }) {
  const dist = size * (big ? 0.85 : 0.7);
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1 - t.value,
    transform: [
      { translateX: Math.cos(angle) * (size * 0.45 + dist * t.value) },
      { translateY: Math.sin(angle) * (size * 0.45 + dist * t.value) },
      { scale: 1 - t.value * 0.5 },
    ],
  }));
  const d = big ? 9 : 6;
  return <Animated.View style={[styles.spark, { width: d, height: d, borderRadius: d / 2, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  disc: { position: 'absolute', opacity: 0.14 },
  ring: { position: 'absolute', borderWidth: 3 },
  spark: { position: 'absolute' },
});
