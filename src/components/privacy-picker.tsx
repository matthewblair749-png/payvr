import { StyleSheet, View } from 'react-native';

import type { Privacy } from '@/data/types';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export const PRIVACY_OPTIONS: { value: Privacy; label: string; icon: IconName; hint: string }[] = [
  { value: 'public', label: 'Public', icon: 'globe', hint: 'Anyone on Payvr' },
  { value: 'friends', label: 'Friends', icon: 'users', hint: 'People you’ve paid' },
  { value: 'private', label: 'Private', icon: 'lock', hint: 'Only you two' },
];

export function privacyIcon(p: Privacy): IconName {
  return PRIVACY_OPTIONS.find((o) => o.value === p)!.icon;
}

/** Compact chips: who can see this payment in the feed (amounts are never shown). */
export function PrivacyPicker({ value, onChange }: { value: Privacy; onChange: (p: Privacy) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Who can see this payment">
      {PRIVACY_OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={`${o.label}: ${o.hint}`}
            aria-checked={active}
            onPress={() => {
              haptics.tap();
              onChange(o.value);
            }}
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: active ? colors.accent : colors.border,
                backgroundColor: active ? colors.surface : 'transparent',
              },
            ]}>
            <Icon name={o.icon} size={16} color={active ? colors.accent : colors.textSecondary} />
            <Text variant="caption" color={active ? 'accent' : 'textSecondary'}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  chip: {
    minHeight: MIN_TAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
});
