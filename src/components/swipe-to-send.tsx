import { useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-provider';
import { haptics } from '@/utils/haptics';
import { smooth } from '@/utils/motion';

import { Icon } from './icon';
import { Text } from './text';

const THRESHOLD = 64;
const MAX = 96;

/**
 * "Swipe up to send": drag the pill upward to confirm. It only expresses intent; the
 * caller still asks for Face ID / PIN. Screen readers get a plain "activate" action.
 */
export function SwipeToSend({ label, onComplete, disabled }: { label: string; onComplete: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const y = useSharedValue(0);
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);

  const startY = useRef(0);

  const reset = () => {
    armedRef.current = false;
    setArmed(false);
    y.set(withTiming(0, smooth(260)));
  };

  // Plain responder events (no PanResponder object), so nothing is created during render.
  const responder = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      startY.current = e.nativeEvent.pageY;
      haptics.tap();
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const next = Math.max(-MAX, Math.min(0, e.nativeEvent.pageY - startY.current));
      y.set(next);
      const isArmed = next < -THRESHOLD;
      if (isArmed !== armedRef.current) {
        armedRef.current = isArmed;
        setArmed(isArmed);
        if (isArmed) haptics.light();
      }
    },
    onResponderRelease: () => {
      const fire = armedRef.current;
      reset();
      if (fire) {
        haptics.medium();
        onComplete();
      }
    },
    onResponderTerminate: reset,
  };

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={styles.wrap}>
      <View style={[styles.hints, { opacity: disabled ? 0.3 : 1 }]} pointerEvents="none">
        <Icon name="chevronUp" size={18} color={colors.accent} strokeWidth={2.4} />
      </View>
      <Animated.View
        {...(disabled ? {} : responder)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Swipe up, or double-tap, to confirm"
        aria-disabled={!!disabled}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => !disabled && onComplete()}
        style={[
          styles.pill,
          { backgroundColor: armed ? colors.success : colors.primary, opacity: disabled ? 0.45 : 1 },
          pillStyle,
        ]}>
        <View style={[styles.knob, { backgroundColor: colors.onPrimary }]}>
          <Icon name="send" size={22} color={armed ? colors.success : colors.primary} strokeWidth={2.6} />
        </View>
        <Text variant="button" style={{ color: colors.onPrimary }}>
          {armed ? 'Release to confirm' : label}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  hints: { height: 18, marginBottom: 4 },
  pill: {
    alignSelf: 'stretch',
    height: 64,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 8,
    cursor: 'grab',
  } as object,
  knob: { position: 'absolute', left: 8, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
