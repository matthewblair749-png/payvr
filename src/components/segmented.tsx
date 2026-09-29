import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { smooth } from '@/utils/motion';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
};

const SLIDE = smooth(280);

/** Tabs in a pill. The blue highlight slides to the chosen option. */
export function Segmented<T extends string>({ options, value, onChange, compact }: Props<T>) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<T, { x: number; w: number }>>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);

  useEffect(() => {
    const l = layouts[value];
    if (!l) return;
    // First placement jumps; after that it slides.
    if (w.value === 0 || reduceMotion) {
      x.set(l.x);
      w.set(l.w);
    } else {
      x.set(withTiming(l.x, SLIDE));
      w.set(withTiming(l.w, SLIDE));
    }
  }, [value, layouts, x, w, reduceMotion]);

  const pill = useAnimatedStyle(() => ({ width: w.value, transform: [{ translateX: x.value }], opacity: w.value ? 1 : 0 }));

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }, compact && styles.compact]}>
      <Animated.View style={[styles.pill, { backgroundColor: colors.primary }, pill]} />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            scaleTo={0.97}
            accessibilityRole="tab"
            aria-selected={active}
            onLayout={(e) => {
              const { x: lx, width } = e.nativeEvent.layout;
              setLayouts((prev) => (prev[o.value]?.x === lx && prev[o.value]?.w === width ? prev : { ...prev, [o.value]: { x: lx, w: width } }));
            }}
            onPress={() => {
              if (!active) haptics.tap();
              onChange(o.value);
            }}
            style={styles.item}>
            <Text variant="bodyMedium" style={{ color: active ? colors.onPrimary : colors.textSecondary }}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  compact: { alignSelf: 'center' },
  // Measured from the wrap's padding box, so it starts at left 0 (x already includes the padding).
  pill: { position: 'absolute', top: 4, bottom: 4, left: 0, borderRadius: 12 },
  item: {
    flex: 1,
    minHeight: MIN_TAP,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
