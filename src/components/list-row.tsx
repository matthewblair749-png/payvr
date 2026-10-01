import { StyleSheet, Switch, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
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
    <PressableScale
      scaleTo={onPress ? 0.985 : 1}
      haptic={onPress ? 'tap' : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}>
      {icon ? <IconTile icon={icon} danger={danger} /> : null}
      <View style={[styles.main, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <Text variant="bodyMedium" style={{ color: tint, flex: 1 }}>
          {label}
        </Text>
        {value ? (
          <Text variant="small" color="textSecondary">
            {value}
          </Text>
        ) : null}
        {right}
        {onPress && !right && !danger ? <Icon name="chevronRight" size={18} color={colors.textSecondary} /> : null}
      </View>
    </PressableScale>
  );
}

/**
 * A settings row with an on/off switch. The whole 56px row is the tap target (the bare
 * switch is smaller than 44px) and it's announced to screen readers as one switch.
 */
export function ToggleRow({
  icon,
  label,
  hint,
  value,
  onChange,
  last,
}: {
  icon?: IconName;
  label: string;
  /** Second line under the label. */
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.985}
      haptic="tap"
      accessibilityRole="switch"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      aria-checked={value}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}>
      {icon ? <IconTile icon={icon} /> : null}
      <View style={[styles.main, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <View style={styles.labels}>
          <Text variant="bodyMedium" style={{ color: colors.text }}>
            {label}
          </Text>
          {hint ? (
            <Text variant="small" color="textSecondary">
              {hint}
            </Text>
          ) : null}
        </View>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden aria-hidden style={styles.noTouch}>
          <Switch
            value={value}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
            {...({ activeThumbColor: '#FFFFFF' } as object)}
          />
        </View>
      </View>
    </PressableScale>
  );
}

/** Row icon on a soft tinted tile (brand blue, or red for destructive rows). */
export function IconTile({ icon, danger, size = 32 }: { icon: IconName; danger?: boolean; size?: number }) {
  const { colors } = useTheme();
  const c = danger ? colors.error : colors.accent;
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.31, backgroundColor: c + '1F' }]}>
      <Icon name={icon} size={Math.round(size * 0.56)} color={c} />
    </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 14, minHeight: 56 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  labels: { flex: 1, paddingVertical: 10 },
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
  noTouch: { pointerEvents: 'none' },
});
