import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';

import { Icon, type IconName } from './icon';

type Props = { icon: IconName; label: string; onPress: () => void; filled?: boolean; color?: string; selected?: boolean };

export function IconButton({ icon, label, onPress, filled, color, selected }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-pressed={selected}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: filled ? colors.surface : 'transparent', opacity: pressed ? 0.6 : 1 },
      ]}>
      <Icon name={icon} size={22} color={color ?? colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: MIN_TAP,
    height: MIN_TAP,
    borderRadius: MIN_TAP / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
