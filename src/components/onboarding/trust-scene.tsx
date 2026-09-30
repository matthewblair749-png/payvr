import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-provider';
import { EASE } from '@/utils/motion';

import { Icon, type IconName } from '../icon';
import { Text } from '../text';

const PROMISES: { icon: IconName; text: string }[] = [
  { icon: 'faceId', text: 'Face ID on every payment' },
  { icon: 'bluetooth', text: 'Only phones right beside yours' },
  { icon: 'lock', text: 'Nothing moves till you confirm' },
];

/** A shield, then three promises easing in one by one (replayed each time the slide arrives). */
export function TrustScene({ active }: { active: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.shield, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.inner, { borderColor: colors.primary }]}>
          <Icon name="shield" size={44} color={colors.accent} strokeWidth={1.8} />
        </View>
      </View>
      {/* Remounting on arrival replays the entrance. */}
      <View key={active ? 'on' : 'off'} style={styles.list}>
        {PROMISES.map((p, i) => (
          <Animated.View
            key={p.text}
            entering={active ? FadeInDown.delay(200 + i * 160).duration(520).easing(EASE) : undefined}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name={p.icon} size={20} color={colors.accent} />
            <Text variant="bodyMedium" numberOfLines={1} style={styles.promise}>
              {p.text}
            </Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 22, width: 330 },
  shield: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  list: { alignSelf: 'stretch', gap: 10 },
  promise: { flexShrink: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
