import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';

import { Text } from './text';

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
};

export function Segmented<T extends string>({ options, value, onChange, compact }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }, compact && styles.compact]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            aria-selected={active}
            onPress={() => {
              if (!active) haptics.tap();
              onChange(o.value);
            }}
            style={[styles.item, active && { backgroundColor: colors.primary }]}>
            <Text variant="bodyMedium" style={{ color: active ? colors.onPrimary : colors.textSecondary }}>
              {o.label}
            </Text>
          </Pressable>
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
  item: {
    flex: 1,
    minHeight: MIN_TAP,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
