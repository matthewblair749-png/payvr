import { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Press in: quick and firm. Release: a softer spring with a hint of bounce. */
const PRESS_IN = { damping: 22, stiffness: 520, mass: 0.6 } as const;
const PRESS_OUT = { damping: 13, stiffness: 300, mass: 0.7 } as const;

type Props = Omit<PressableProps, 'style'> & {
  /** How far it sinks while held (1 = not at all). */
  scaleTo?: number;
  /** Haptic on press (native only). Leave off where the handler already buzzes. */
  haptic?: 'tap' | 'light' | 'medium';
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
};

/**
 * Drop-in Pressable that sinks on touch and springs back on release, animated on the UI thread
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
        if (!reduceMotion && scaleTo !== 1) scale.set(withSpring(scaleTo, PRESS_IN));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        scale.set(withSpring(1, PRESS_OUT));
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
