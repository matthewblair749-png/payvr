import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Card } from '@/components/list-row';
import { PRIVACY_OPTIONS } from '@/components/privacy-picker';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useSocial } from '@/store/social-store';
import { useTheme } from '@/theme/theme-provider';
import { haptics } from '@/utils/haptics';

/** Who sees new payments in the feed by default. You can still change it on each payment. */
export default function PrivacySettings() {
  const { colors } = useTheme();
  const { defaultPrivacy, setDefaultPrivacy } = useSocial();
  return (
    <Screen back="back" title="Privacy">
      <Text variant="small" color="textSecondary" style={styles.intro}>
        Who sees your new payments in the feed. Amounts are never shown to anyone but you and the other person.
      </Text>
      <Card>
        {PRIVACY_OPTIONS.map((o, i) => {
          const active = defaultPrivacy === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityLabel={`${o.label}: ${o.hint}`}
              aria-checked={active}
              onPress={() => {
                haptics.tap();
                setDefaultPrivacy(o.value);
              }}
              style={({ pressed }) => [
                styles.row,
                { opacity: pressed ? 0.7 : 1 },
                i < PRIVACY_OPTIONS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}>
              <Icon name={o.icon} size={22} color={colors.accent} />
              <View style={styles.flex}>
                <Text variant="bodyMedium">{o.label}</Text>
                <Text variant="small" color="textSecondary">
                  {o.hint}
                </Text>
              </View>
              {active ? <Icon name="check" color={colors.accent} /> : null}
            </Pressable>
          );
        })}
      </Card>
      <Text variant="small" color="textSecondary" style={styles.note}>
        You can change who sees any payment when you send it, or later from the feed.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: 8, marginBottom: 12, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: 16 },
  flex: { flex: 1 },
  note: { marginTop: 12, marginLeft: 4 },
});
