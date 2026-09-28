import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Card } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import type { ThemePreference } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';
import { haptics } from '@/utils/haptics';

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'dark', label: 'Dark', hint: 'Default' },
  { value: 'light', label: 'Light', hint: '' },
  { value: 'system', label: 'System', hint: 'Match your phone' },
];

export default function Appearance() {
  const { colors, preference, setPreference } = useTheme();
  return (
    <Screen back="back" title="Appearance">
      <Card style={styles.card}>
        {OPTIONS.map((o, i) => {
          const active = preference === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => {
                haptics.tap();
                setPreference(o.value);
              }}
              style={[
                styles.row,
                i < OPTIONS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}>
              <View style={styles.flex}>
                <Text variant="bodyMedium">{o.label}</Text>
                {o.hint ? <Text variant="small" color="textSecondary">{o.hint}</Text> : null}
              </View>
              {active ? <Icon name="check" color={colors.accent} /> : null}
            </Pressable>
          );
        })}
      </Card>
      <Text variant="small" color="textSecondary" style={styles.note}>
        Saved on this device.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: 16 },
  flex: { flex: 1 },
  note: { marginTop: 12, marginLeft: 4 },
});
