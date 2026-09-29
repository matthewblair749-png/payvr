import { StyleSheet } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

type Props = { icon: IconName; label: string; onPress: () => void; filled?: boolean; color?: string; selected?: boolean };

export function IconButton({ icon, label, onPress, filled, color, selected }: Props) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.9}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-pressed={selected}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: filled ? colors.surface : 'transparent', opacity: pressed ? 0.75 : 1 },
      ]}>
      <Icon name={icon} size={22} color={color ?? colors.text} />
    </PressableScale>
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
