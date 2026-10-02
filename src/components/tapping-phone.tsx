import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/theme-provider';

import { LogoGlyph } from './logo';

/** One smooth swing: tilt down toward the other phone, then back up. */
const HALF = 1100;
/** One lap of the radar sweep. */
const SWEEP_MS = 2600;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A little phone: white frame, softly lit screen with the Payvr mark, notch and home bar. */
function PhoneGlyph({ height }: { height: number }) {
  const width = height * 0.56;
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox="0 0 56 100" fill="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.34" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.08" />
          </LinearGradient>
        </Defs>
        <Rect x="3" y="3" width="50" height="94" rx="12" fill="url(#screen)" stroke="#FFFFFF" strokeWidth="5" />
        <Rect x="20" y="10" width="16" height="5" rx="2.5" fill="#FFFFFF" />
        <Rect x="21" y="86" width="14" height="3.5" rx="1.75" fill="#FFFFFF" opacity={0.85} />
      </Svg>
      <View style={styles.mark}>
        <LogoGlyph size={height * 0.36} color="#FFFFFF" />
      </View>
    </View>
  );
}

/**
 * The heart of the Tap screen: a glowing blue orb with a phone that smoothly tips down and
 * back up, like pointing it at the other phone. Around it, a light sweeps like radar and a
 * thin ring counts down the session. Still when Reduce Motion is on.
 *
 * `progress` is the share of the session left (1 → 0).
 */
export function TappingPhone({ size = 132, active = true, progress = 1 }: { size?: number; active?: boolean; progress?: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  const sweep = useSharedValue(0);
  const left = useSharedValue(progress);
  const animate = active && !reduceMotion;

  useEffect(() => {
    if (!animate) {
      cancelAnimation(t);
      cancelAnimation(sweep);
      t.value = withTiming(0, { duration: 300, easing: Easing.inOut(Easing.sin) });
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    t.value = withRepeat(withSequence(withTiming(1, { duration: HALF, easing: ease }), withTiming(0, { duration: HALF, easing: ease })), -1);
    sweep.value = 0;
    sweep.value = withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(t);
      cancelAnimation(sweep);
    };
  }, [animate, t, sweep]);

  // Glide the countdown between the screen's half-second ticks.
  useEffect(() => {
    left.value = withTiming(progress, { duration: 520, easing: Easing.linear });
  }, [progress, left]);

  const phoneStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 420 }, { translateY: t.value * size * 0.06 }, { rotateX: `${t.value * 42}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + t.value * 0.35,
    transform: [{ scale: 1 + t.value * 0.08 }],
  }));
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sweep.value * 360}deg` }] }));

  // Countdown ring just outside the orb.
  const outer = size * 1.34;
  const r = outer / 2 - 3;
  const circumference = 2 * Math.PI * r;
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - left.value) }));

  return (
    <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
      {/* Soft halo that brightens as the phone points down. */}
      <Animated.View
        style={[
          styles.abs,
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

      {/* Countdown: a thin track with the time left drawn over it. */}
      <Svg width={outer} height={outer} style={styles.abs}>
        <Circle cx={outer / 2} cy={outer / 2} r={r} stroke={colors.primary} strokeOpacity={0.22} strokeWidth={3} fill="none" />
        {active ? (
          <AnimatedCircle
            cx={outer / 2}
            cy={outer / 2}
            r={r}
            stroke={colors.accent}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={ringProps}
            transform={`rotate(-90 ${outer / 2} ${outer / 2})`}
          />
        ) : null}
      </Svg>

      {/* Radar sweep: a comet of light circling the orb. */}
      {animate ? (
        <Animated.View style={[styles.abs, { width: outer, height: outer }, sweepStyle]}>
          <Svg width={outer} height={outer}>
            <Defs>
              <LinearGradient id="comet" x1="0.5" y1="0" x2="1" y2="0.5">
                {/* Bright head leading clockwise, fading tail behind it. */}
                <Stop offset="0" stopColor={colors.primary} stopOpacity="0" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.95" />
              </LinearGradient>
            </Defs>
            <Circle
              cx={outer / 2}
              cy={outer / 2}
              r={r}
              stroke="url(#comet)"
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference * 0.22} ${circumference}`}
              transform={`rotate(-90 ${outer / 2} ${outer / 2})`}
            />
          </Svg>
        </Animated.View>
      ) : null}

      <View
        style={[
          styles.orb,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.primary,
            boxShadow: `0 0 ${Math.round(size * 0.45)}px ${Math.round(size * 0.12)}px ${colors.primary}99, inset 0 ${Math.round(size * 0.06)}px ${Math.round(size * 0.16)}px #FFFFFF33`,
          },
        ]}>
        <Animated.View style={phoneStyle}>
          <PhoneGlyph height={size * 0.5} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', pointerEvents: 'none' },
  orb: { alignItems: 'center', justifyContent: 'center' },
  mark: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
