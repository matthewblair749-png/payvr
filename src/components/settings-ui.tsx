import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-provider';
import { Fonts } from '@/theme/typography';
import { listEnter } from '@/utils/motion';

import { Icon, type IconName } from './icon';
import { IconTile } from './list-row';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

/** Large title block at the top of a settings screen: icon, title, one plain sentence. */
export function SettingsHero({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <Animated.View entering={listEnter(0)} style={styles.hero}>
      <IconTile icon={icon} size={52} />
      <Text variant="title" accessibilityRole="header" style={styles.heroTitle}>
        {title}
      </Text>
      <Text color="textSecondary">{body}</Text>
    </Animated.View>
  );
}

/** Staggered section wrapper so a settings screen settles in top to bottom. */
export function Section({ index, children, style }: { index: number; children: React.ReactNode; style?: object }) {
  return (
    <Animated.View entering={listEnter(index)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Small explanatory text under a card. */
export function Footnote({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'error' }) {
  const { colors } = useTheme();
  return (
    <View style={styles.note}>
      <Icon name={tone === 'error' ? 'close' : 'help'} size={14} color={tone === 'error' ? colors.error : colors.textSecondary} />
      <Text variant="small" color={tone === 'error' ? 'error' : 'textSecondary'} style={styles.noteText}>
        {children}
      </Text>
    </View>
  );
}

/** A selectable option drawn as its own card, with a radio dot. */
export function ChoiceCard({
  icon,
  label,
  hint,
  selected,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.98}
      haptic="tap"
      accessibilityRole="radio"
      accessibilityLabel={`${label}: ${hint}`}
      aria-checked={selected}
      onPress={onPress}
      style={[
        styles.choice,
        { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.border },
        selected && styles.choiceSelected,
      ]}>
      <IconTile icon={icon} size={40} />
      <View style={styles.flex}>
        <Text variant="bodyMedium">{label}</Text>
        <Text variant="small" color="textSecondary">
          {hint}
        </Text>
      </View>
      <Radio on={selected} />
    </PressableScale>
  );
}

export function Radio({ on }: { on: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.radio, { borderColor: on ? colors.primary : colors.textSecondary }, on && { backgroundColor: colors.primary }]}>
      {on ? <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={3} /> : null}
    </View>
  );
}

/** A thin progress meter (e.g. how much of the daily limit is used). */
export function Meter({ value, max }: { value: number; max: number }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const tone = pct >= 0.9 ? colors.error : colors.primary;
  return (
    <View
      accessibilityRole="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      style={[styles.track, { backgroundColor: colors.border }]}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: tone }]} />
    </View>
  );
}

/** Big tabular figure used inside settings cards (limits, counts). */
export function Figure({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.figure, { color: colors.text }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  hero: { gap: 6, paddingTop: 4, paddingBottom: 8 },
  heroTitle: { marginTop: 10 },
  note: { flexDirection: 'row', gap: 8, marginTop: 10, marginHorizontal: 4 },
  noteText: { flex: 1 },
  flex: { flex: 1 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  choiceSelected: { borderWidth: 2, paddingHorizontal: 13 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  figure: { fontFamily: Fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
});
