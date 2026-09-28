import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

import { Icon, type IconName } from './icon';
import { Text } from './text';

type Props = {
  icon?: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  last?: boolean;
};

/** Settings-style row, meant to sit inside a <Card>. */
export function ListRow({ icon, label, value, onPress, right, danger, last }: Props) {
  const { colors } = useTheme();
  const tint = danger ? colors.error : colors.text;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      {icon ? <Icon name={icon} size={22} color={danger ? colors.error : colors.accent} /> : null}
      <View style={[styles.main, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <Text variant="bodyMedium" style={{ color: tint, flex: 1 }}>
          {label}
        </Text>
        {value ? <Text color="textSecondary">{value}</Text> : null}
        {right}
        {onPress && !right && !danger ? <Icon name="chevronRight" size={20} color={colors.textSecondary} /> : null}
      </View>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="caption" color="textSecondary" style={styles.section}>
      {children.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 16, minHeight: 56 },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingRight: 14,
  },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  section: { letterSpacing: 0.8, marginTop: 28, marginBottom: 10, marginLeft: 4 },
});
