import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-provider';
import { haptics } from '@/utils/haptics';

import { Keypad } from './keypad';
import { Text } from './text';

export const PIN_LENGTH = 4;

type Props = {
  title: string;
  subtitle?: string;
  /** Return false to shake and clear (wrong PIN). */
  onComplete: (pin: string) => boolean | void;
  error?: string | null;
};

export function PinPad({ title, subtitle, onComplete, error }: Props) {
  const { colors } = useTheme();
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const press = (k: string) => {
    setWrong(false);
    if (k === 'back') return setPin((p) => p.slice(0, -1));
    if (k === '.' || pin.length >= PIN_LENGTH) return;
    const next = pin + k;
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    if (onComplete(next) === false) {
      haptics.error();
      setWrong(true);
      shake.set(
        withSequence(
          withTiming(-10, { duration: 50 }),
          withTiming(10, { duration: 50 }),
          withTiming(-6, { duration: 50 }),
          withTiming(0, { duration: 50 }),
        ),
      );
      setTimeout(() => setPin(''), 250);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Text variant="title" align="center" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text color="textSecondary" align="center" style={styles.sub}>
            {subtitle}
          </Text>
        ) : null}
        <Animated.View
          style={[styles.dots, shakeStyle]}
          accessibilityLabel={`${pin.length} of ${PIN_LENGTH} digits entered`}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { borderColor: wrong ? colors.error : colors.border },
                i < pin.length && { backgroundColor: wrong ? colors.error : colors.primary, borderColor: 'transparent' },
              ]}
            />
          ))}
        </Animated.View>
        <Text variant="small" color="error" align="center" style={{ minHeight: 20 }}>
          {wrong ? 'That PIN is not right. Try again.' : (error ?? '')}
        </Text>
      </View>
      <Keypad integer onKey={press} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'space-between' },
  top: { alignItems: 'center', paddingTop: 24, gap: 8 },
  sub: { maxWidth: 300 },
  dots: { flexDirection: 'row', gap: 18, marginTop: 28, marginBottom: 8 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
});
