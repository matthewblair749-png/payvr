import { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics } from '@/utils/haptics';
import { smooth } from '@/utils/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Press in: quick and firm. Release: an unhurried glide back to rest (no bounce). */
const PRESS_IN = { duration: 110, easing: Easing.out(Easing.quad) };
const PRESS_OUT = smooth(240);

type Props = Omit<PressableProps, 'style'> & {
  /** How far it sinks while held (1 = not at all). */
  scaleTo?: number;
  /** Haptic on press (native only). Leave off where the handler already buzzes. */
  haptic?: 'tap' | 'light' | 'medium';
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
};

/**
 * Drop-in Pressable that sinks on touch and eases back on release, animated on the UI thread
 * (smooth even while JS is busy). With Reduce Motion on, it only uses the pressed styles.
 */
export function PressableScale({ scaleTo = 0.96, haptic, style, onPressIn, onPressOut, onPress, ...rest }: Props) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        if (!reduceMotion && scaleTo !== 1) scale.set(withTiming(scaleTo, PRESS_IN));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        scale.set(withTiming(1, PRESS_OUT));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) haptics[haptic]();
        onPress?.(e);
      }}
      style={[typeof style === 'function' ? style({ pressed }) : style, animated]}
    />
  );
}
